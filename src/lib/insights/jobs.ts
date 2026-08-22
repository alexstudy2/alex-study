import "server-only";

import { prisma } from "@/lib/db/prisma";
import { groq } from "@/lib/ai/groq";
import { makeAIJobKey } from "@/lib/ai/jobs";
import { loadPersonalSignalData } from "./data";
import { generateAndStoreInsight } from "./service";
import {
  buildWeeklyRecapSignal,
  detectBestTime,
  detectBurnoutRisk,
  detectPerformanceDrop,
  type InsightSignal,
} from "./signals";

type JobSummary = {
  usersChecked: number;
  signalsFound: number;
  created: number;
  cached: number;
  failed: number;
  skipped: number;
  errors: Record<string, number>;
  batch: {
    processedFrom: string | null;
    nextCursor: string | null;
    cycleCompleted: boolean;
  };
};

function emptySummary(
  usersChecked: number,
  batch: JobSummary["batch"] = {
    processedFrom: null,
    nextCursor: null,
    cycleCompleted: true,
  },
): JobSummary {
  return {
    usersChecked,
    signalsFound: 0,
    created: 0,
    cached: 0,
    failed: 0,
    skipped: 0,
    errors: {},
    batch,
  };
}

const SCHEDULED_BATCH_SIZE = 25;

async function eligibleUsers(jobName: string) {
  const state = await prisma.scheduledJobCursor.findUnique({ where: { jobName } });
  const processedFrom = state?.cursor ?? null;
  const users = await prisma.user.findMany({
    where: {
      aiNudgesEnabled: true,
      ...(processedFrom ? { id: { gt: processedFrom } } : {}),
    },
    select: { id: true, preference: { select: { locale: true } } },
    orderBy: { id: "asc" },
    take: SCHEDULED_BATCH_SIZE + 1,
  });
  const page = users.slice(0, SCHEDULED_BATCH_SIZE);
  return {
    users: page,
    processedFrom,
    nextCursor: users.length > SCHEDULED_BATCH_SIZE ? (page.at(-1)?.id ?? null) : null,
  };
}

async function finishBatch(jobName: string, nextCursor: string | null, now: Date) {
  await prisma.scheduledJobCursor.upsert({
    where: { jobName },
    update: {
      cursor: nextCursor,
      ...(nextCursor ? {} : { cycleCompletedAt: now }),
    },
    create: {
      jobName,
      cursor: nextCursor,
      cycleCompletedAt: nextCursor ? null : now,
    },
  });
}

async function generateScheduledSignal(
  userId: string,
  locale: "en" | "ar",
  signal: InsightSignal,
  now: Date,
) {
  return generateAndStoreInsight({
    userId,
    locale,
    signal,
    jobKey: makeAIJobKey(signal.type, {
      userId,
      detectorVersion: signal.detectorVersion,
      periodFrom: signal.period.from,
    }),
    operation: `scheduled_${signal.type.toLowerCase()}`,
    notify: true,
    now,
  });
}

function recordResult(
  summary: JobSummary,
  result: Awaited<ReturnType<typeof generateScheduledSignal>>,
) {
  if (result.ok) {
    if (result.cached) summary.cached += 1;
    else summary.created += 1;
    return;
  }
  summary.failed += 1;
  summary.errors[result.error] = (summary.errors[result.error] ?? 0) + 1;
}

export async function runAIRecaps(now = new Date()) {
  if (!groq) return { ...emptySummary(0), unavailable: true };
  const page = await eligibleUsers("ai-recaps");
  const summary = emptySummary(page.users.length, {
    processedFrom: page.processedFrom,
    nextCursor: page.nextCursor,
    cycleCompleted: page.nextCursor === null,
  });
  for (const user of page.users) {
    const data = await loadPersonalSignalData(user.id, now);
    const signals = [buildWeeklyRecapSignal(data, now), detectBestTime(data, now)].filter(
      (signal): signal is InsightSignal => Boolean(signal),
    );
    if (!signals.length) {
      summary.skipped += 1;
      continue;
    }
    summary.signalsFound += signals.length;
    for (const signal of signals)
      recordResult(
        summary,
        await generateScheduledSignal(
          user.id,
          user.preference?.locale === "AR" ? "ar" : "en",
          signal,
          now,
        ),
      );
  }
  await finishBatch("ai-recaps", page.nextCursor, now);
  return summary;
}

async function runDetector(
  detector: (
    data: Awaited<ReturnType<typeof loadPersonalSignalData>>,
    now: Date,
  ) => InsightSignal | null,
  jobName: string,
  now: Date,
) {
  if (!groq) return { ...emptySummary(0), unavailable: true };
  const page = await eligibleUsers(jobName);
  const summary = emptySummary(page.users.length, {
    processedFrom: page.processedFrom,
    nextCursor: page.nextCursor,
    cycleCompleted: page.nextCursor === null,
  });
  for (const user of page.users) {
    const signal = detector(await loadPersonalSignalData(user.id, now), now);
    if (!signal) {
      summary.skipped += 1;
      continue;
    }
    summary.signalsFound += 1;
    recordResult(
      summary,
      await generateScheduledSignal(
        user.id,
        user.preference?.locale === "AR" ? "ar" : "en",
        signal,
        now,
      ),
    );
  }
  await finishBatch(jobName, page.nextCursor, now);
  return summary;
}

export function runPerformanceDetection(now = new Date()) {
  return runDetector(detectPerformanceDrop, "performance-detection", now);
}

export function runBurnoutDetection(now = new Date()) {
  return runDetector(detectBurnoutRisk, "burnout-detection", now);
}

export async function runAICleanup(now = new Date()) {
  /* Retention rules (audit H7): docs/OPERATIONS.md promised a 30-day lobby-chat window
     and nothing enforced it; drafts carried an expiresAt nobody read; expired recovery
     tokens and accountability check-ins accrued forever. Each deleteMany below has a
     matching index from migration 202608220019_phase2_integrity. */
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);
  const [insights, plans, messages, drafts, resetTokens, checks] = await prisma.$transaction([
    prisma.aIInsight.deleteMany({ where: { purgeAt: { lte: now } } }),
    prisma.examPlan.updateMany({
      where: {
        syllabusText: { not: null },
        contextPurgeAt: { lte: now },
        contextPurgedAt: null,
      },
      data: { syllabusText: null, contextPurgedAt: now },
    }),
    prisma.roomMessage.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
    prisma.taskDraft.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null, lte: sevenDaysAgo } }],
      },
    }),
    prisma.accountabilityCheck.deleteMany({ where: { sentAt: { lt: ninetyDaysAgo } } }),
  ]);
  return {
    insightsPurged: insights.count,
    examPlanContextsPurged: plans.count,
    roomMessagesPurged: messages.count,
    taskDraftsPurged: drafts.count,
    resetTokensPurged: resetTokens.count,
    accountabilityChecksPurged: checks.count,
  };
}
