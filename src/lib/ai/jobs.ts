import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { AI_PROMPT_VERSION, assessAIAllowance } from "@/lib/ai/policy";
import { getTaskDateWindow } from "@/lib/tasks/dates";

export { AI_PROMPT_VERSION, AI_RETENTION_DAYS, hashAIInput, makeAIJobKey } from "@/lib/ai/policy";

export type AIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

async function checkAIAllowance(userId: string, type: string, now: Date, excludeJobId?: string) {
  const day = getTaskDateWindow("today", now)!;
  const jobWhere = excludeJobId ? { id: { not: excludeJobId } } : {};
  const [globalUsage, userUsage, userJobs, typeJobs] = await Promise.all([
    prisma.serviceUsageLog.aggregate({
      where: { service: "groq", occurredAt: day },
      _sum: { units: true },
    }),
    prisma.serviceUsageLog.aggregate({
      where: { userId, service: "groq", occurredAt: day },
      _sum: { units: true },
    }),
    prisma.aIJob.count({ where: { userId, createdAt: day, ...jobWhere } }),
    prisma.aIJob.count({ where: { userId, type, createdAt: day, ...jobWhere } }),
  ]);
  return assessAIAllowance({
    globalTokens: globalUsage._sum.units ?? 0,
    userTokens: userUsage._sum.units ?? 0,
    userJobs,
    typeJobs,
    type,
  });
}

function errorCode(reason: unknown) {
  if (reason instanceof Error) {
    if (
      reason.message === "ai_unavailable" ||
      reason.message === "empty_ai_response" ||
      reason.message === "invalid_ai_response"
    )
      return reason.message;
  }
  return "ai_request_failed";
}

function isRetryable(code: string) {
  return (
    code === "empty_ai_response" || code === "invalid_ai_response" || code === "ai_request_failed"
  );
}

type RunTrackedAIJobInput<T> = {
  userId: string;
  type: string;
  operation: string;
  jobKey: string;
  inputHash: string;
  maxAttempts?: number;
  metadata?: Prisma.InputJsonValue;
  now?: Date;
  run: (helpers: { jobId: string; recordUsage: (usage?: AIUsage) => Promise<void> }) => Promise<T>;
};

export type TrackedAIJobResult<T> =
  | { ok: true; cached: false; jobId: string; value: T }
  | { ok: true; cached: true; jobId: string }
  | { ok: false; error: string; status: 409 | 429 | 503; jobId?: string };

export async function runTrackedAIJob<T>(
  input: RunTrackedAIJobInput<T>,
): Promise<TrackedAIJobResult<T>> {
  const now = input.now ?? new Date();
  const existing = await prisma.aIJob.findUnique({ where: { jobKey: input.jobKey } });
  if (existing?.status === "COMPLETED") return { ok: true, cached: true, jobId: existing.id };
  if (existing?.status === "RUNNING" && existing.updatedAt.getTime() > now.getTime() - 2 * 60_000)
    return { ok: false, error: "ai_in_progress", status: 409, jobId: existing.id };

  const allowance = await checkAIAllowance(input.userId, input.type, now, existing?.id);
  if (allowance) return { ok: false, error: allowance, status: 429 };

  const maxAttempts = input.maxAttempts ?? 2;
  const job = await prisma.aIJob.upsert({
    where: { jobKey: input.jobKey },
    update: {
      maxAttempts,
      metadata: input.metadata,
      model: GROQ_MODEL,
      promptVersion: AI_PROMPT_VERSION,
    },
    create: {
      userId: input.userId,
      jobKey: input.jobKey,
      type: input.type,
      inputHash: input.inputHash,
      maxAttempts,
      model: GROQ_MODEL,
      promptVersion: AI_PROMPT_VERSION,
      metadata: input.metadata,
    },
  });
  if (job.attempts >= maxAttempts)
    return {
      ok: false,
      error: job.errorCode ?? "ai_request_failed",
      status: 503,
      jobId: job.id,
    };

  let attempt = job.attempts;
  while (attempt < maxAttempts) {
    attempt += 1;
    await prisma.aIJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        attempts: attempt,
        startedAt: job.startedAt ?? now,
        failedAt: null,
        errorCode: null,
      },
    });
    try {
      const value = await input.run({
        jobId: job.id,
        recordUsage: async (usage) => {
          await prisma.serviceUsageLog.create({
            data: {
              userId: input.userId,
              aiJobId: job.id,
              service: "groq",
              operation: input.operation,
              model: GROQ_MODEL,
              units: usage?.total_tokens ?? 1,
              inputUnits: usage?.prompt_tokens,
              outputUnits: usage?.completion_tokens,
              metadata: {
                attempt,
                promptVersion: AI_PROMPT_VERSION,
              },
            },
          });
        },
      });
      await prisma.aIJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date(), errorCode: null },
      });
      return { ok: true, cached: false, jobId: job.id, value };
    } catch (reason) {
      const code = errorCode(reason);
      if (attempt < maxAttempts && isRetryable(code)) continue;
      await prisma.aIJob.update({
        where: { id: job.id },
        data: { status: "FAILED", failedAt: new Date(), errorCode: code },
      });
      return { ok: false, error: code, status: 503, jobId: job.id };
    }
  }
  return { ok: false, error: "ai_request_failed", status: 503, jobId: job.id };
}
