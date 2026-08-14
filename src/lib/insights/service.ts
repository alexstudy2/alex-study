import "server-only";

import { addDays } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { hashAIInput, makeAIJobKey, runTrackedAIJob } from "@/lib/ai/jobs";
import { AI_RETENTION_DAYS } from "@/lib/ai/policy";
import { createNotification } from "@/lib/notifications/service";
import { loadPersonalSignalData } from "./data";
import { generateInsight } from "./ai";
import { buildDailyTipSignal, type InsightSignal, type InsightType } from "./signals";

export const insightSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  supportingData: true,
  model: true,
  validFrom: true,
  validUntil: true,
  dismissedAt: true,
  createdAt: true,
} as const;

type Locale = "en" | "ar";

function validDays(type: InsightType) {
  if (type === "DAILY_TIP") return 1;
  if (type === "BEST_TIME" || type === "WEEKLY_RECAP") return 14;
  return 7;
}

function signalMetadata(signal: InsightSignal) {
  return {
    detectorVersion: signal.detectorVersion,
    confidence: signal.confidence,
    period: signal.period,
    facts: signal.facts,
    attribution: "aggregate_personal_data",
  };
}

export type InsightGenerationResult =
  | { ok: true; cached: boolean; insight: Record<string, unknown> }
  | { ok: false; error: string; status: 403 | 409 | 429 | 503 };

export async function generateAndStoreInsight(input: {
  userId: string;
  locale: Locale;
  signal: InsightSignal;
  jobKey?: string;
  operation?: string;
  notify?: boolean;
  now?: Date;
}): Promise<InsightGenerationResult> {
  const now = input.now ?? new Date();
  const profile = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { aiNudgesEnabled: true, preference: { select: { aiInsightNotifications: true } } },
  });
  if (!profile?.aiNudgesEnabled) return { ok: false, error: "ai_disabled", status: 403 };
  const inputHash = hashAIInput(input.signal);
  const jobKey =
    input.jobKey ??
    makeAIJobKey(input.signal.type, {
      userId: input.userId,
      inputHash,
      period: input.signal.period,
    });
  const tracked = await runTrackedAIJob({
    userId: input.userId,
    type: input.signal.type,
    operation: input.operation ?? input.signal.type.toLowerCase(),
    jobKey,
    inputHash,
    metadata: {
      detectorVersion: input.signal.detectorVersion,
      period: input.signal.period,
      confidence: input.signal.confidence,
    },
    now,
    run: async ({ jobId, recordUsage }) => {
      const copy = await generateInsight(input.signal, input.locale, recordUsage);
      return prisma.aIInsight.upsert({
        where: { aiJobId: jobId },
        update: {
          title: copy.title,
          content: copy.content,
          supportingData: signalMetadata(input.signal),
          model: GROQ_MODEL,
          validFrom: now,
          validUntil: addDays(now, validDays(input.signal.type)),
          purgeAt: addDays(now, AI_RETENTION_DAYS),
          dismissedAt: null,
        },
        create: {
          userId: input.userId,
          aiJobId: jobId,
          type: input.signal.type,
          title: copy.title,
          content: copy.content,
          supportingData: signalMetadata(input.signal),
          model: GROQ_MODEL,
          validFrom: now,
          validUntil: addDays(now, validDays(input.signal.type)),
          purgeAt: addDays(now, AI_RETENTION_DAYS),
        },
        select: insightSelect,
      });
    },
  });
  if (!tracked.ok) return { ok: false, error: tracked.error, status: tracked.status };
  if (tracked.cached) {
    const cached = await prisma.aIInsight.findFirst({
      where: { aiJobId: tracked.jobId, userId: input.userId },
      select: insightSelect,
    });
    if (!cached) return { ok: false, error: "ai_in_progress", status: 409 };
    return { ok: true, cached: true, insight: cached as unknown as Record<string, unknown> };
  }
  const created = tracked.value;
  if (input.notify && profile.preference?.aiInsightNotifications !== false)
    await createNotification({
      userId: input.userId,
      type: "AI_INSIGHT",
      title: created.title,
      body: created.content,
      actionUrl: "/insights",
      preference: "aiInsightNotifications",
      metadata: { insightId: created.id, insightType: created.type },
    });
  return { ok: true, cached: false, insight: created as unknown as Record<string, unknown> };
}

export async function generateDailyTip(userId: string, locale: Locale, now = new Date()) {
  const data = await loadPersonalSignalData(userId, now);
  const signal = buildDailyTipSignal(data, now);
  return generateAndStoreInsight({
    userId,
    locale,
    signal,
    operation: "daily_insight",
    notify: false,
    now,
  });
}
