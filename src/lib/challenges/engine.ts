import type { ChallengeSourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { syncChallengeBadges } from "@/lib/challenges/badges";
import {
  eligibleSessions,
  eligibleTasks,
  progressEventRevision,
  resolveChallenge,
  targetReachedAt,
} from "@/lib/challenges/rules";

type DesiredSource = {
  sourceType: ChallengeSourceType;
  sourceId: string;
  value: number;
  occurredAt: Date;
};

function desiredKey(source: Pick<DesiredSource, "sourceType" | "sourceId">) {
  return `${source.sourceType}:${source.sourceId}`;
}

async function participantSources(
  tx: Prisma.TransactionClient,
  challenge: {
    type: string;
    subjectKey: string | null;
    acceptedAt: Date | null;
    startsAt: Date;
    endsAt: Date;
  },
  userId: string,
) {
  const startsAt = new Date(
    Math.max(challenge.startsAt.getTime(), challenge.acceptedAt?.getTime() ?? 0),
  );
  if (startsAt >= challenge.endsAt) return [];
  if (challenge.type.includes("TASK_COUNT")) {
    const tasks = await tx.task.findMany({
      where: {
        userId,
        completedAt: { gte: startsAt, lte: challenge.endsAt },
      },
      select: {
        id: true,
        completedAt: true,
        estimatedMinutes: true,
        status: true,
        deletedAt: true,
        parentTaskId: true,
        subject: { select: { normalizedName: true } },
      },
    });
    return eligibleTasks(
      tasks.map((task) => ({ ...task, subjectKey: task.subject?.normalizedName ?? null })),
      challenge.type.startsWith("SUBJECT_") ? challenge.subjectKey : null,
    ).map((task) => ({
      sourceType: "TASK" as const,
      sourceId: task.id,
      value: 1,
      occurredAt: task.completedAt!,
    }));
  }
  const sessions = await tx.studySession.findMany({
    where: {
      userId,
      endedAt: { gte: startsAt, lte: challenge.endsAt },
    },
    select: {
      id: true,
      endedAt: true,
      durationSeconds: true,
      status: true,
      source: true,
      subject: { select: { normalizedName: true } },
    },
  });
  return eligibleSessions(
    sessions.map((session) => ({
      ...session,
      subjectKey: session.subject?.normalizedName ?? null,
    })),
    challenge.type.startsWith("SUBJECT_") ? challenge.subjectKey : null,
  ).map((session) => ({
    sourceType: "STUDY_SESSION" as const,
    sourceId: session.id,
    value: Math.floor(session.durationSeconds / 60),
    occurredAt: session.endedAt!,
  }));
}

export async function reconcileChallenge(challengeId: string, now = new Date()) {
  const result = await prisma.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      include: { progress: true },
    });
    if (
      !challenge ||
      !challenge.acceptedAt ||
      ["PENDING", "DECLINED", "CANCELLED"].includes(challenge.status)
    )
      return null;
    const before = { status: challenge.status, winnerId: challenge.winnerId };
    const calculated: Array<{
      id: string;
      userId: string;
      currentValue: number;
      targetReachedAt: Date | null;
    }> = [];
    for (const progress of challenge.progress) {
      const desired = await participantSources(tx, challenge, progress.userId);
      const desiredByKey = new Map(desired.map((source) => [desiredKey(source), source]));
      const existing = await tx.challengeProgressEvent.findMany({
        where: { progressId: progress.id },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      });
      const net = new Map<string, number>();
      for (const event of existing) {
        const key = `${event.sourceType}:${event.sourceId}`;
        net.set(key, (net.get(key) ?? 0) + event.deltaValue);
      }
      const keys = new Set([...net.keys(), ...desiredByKey.keys()]);
      const events: Prisma.ChallengeProgressEventCreateManyInput[] = [];
      for (const key of keys) {
        const source = desiredByKey.get(key);
        const current = net.get(key) ?? 0;
        const wanted = source?.value ?? 0;
        const [sourceType, sourceId] = key.split(":") as [ChallengeSourceType, string];
        const sourceEvents = existing.filter(
          (event) => event.sourceType === sourceType && event.sourceId === sourceId,
        );
        const revision = progressEventRevision({
          current,
          wanted,
          hasHistory: sourceEvents.length > 0,
          sourceOccurredAt: source?.occurredAt ?? now,
          now,
        });
        if (!revision) continue;
        events.push({
          challengeId: challenge.id,
          progressId: progress.id,
          sourceType,
          sourceId,
          eventType: revision.eventType,
          deltaValue: revision.delta,
          idempotencyKey: `${challenge.id}:${progress.id}:${sourceType}:${sourceId}:${sourceEvents.length}:${wanted}`,
          occurredAt: revision.occurredAt,
        });
      }
      if (events.length)
        await tx.challengeProgressEvent.createMany({ data: events, skipDuplicates: true });
      const total = await tx.challengeProgressEvent.aggregate({
        where: { progressId: progress.id },
        _sum: { deltaValue: true },
      });
      const currentValue = Math.max(0, total._sum.deltaValue ?? 0);
      const reachedAt = targetReachedAt(
        desired.map((source) => ({ occurredAt: source.occurredAt, value: source.value })),
        challenge.targetValue,
      );
      await tx.challengeProgress.update({
        where: { id: progress.id },
        data: { currentValue, targetReachedAt: reachedAt, lastCalculatedAt: now },
      });
      calculated.push({
        id: progress.id,
        userId: progress.userId,
        currentValue,
        targetReachedAt: reachedAt,
      });
    }
    const resolution = resolveChallenge({
      resolutionType: challenge.resolutionType,
      targetValue: challenge.targetValue,
      startsAt: challenge.startsAt,
      endsAt: challenge.endsAt,
      now,
      participants: calculated.map((item) => ({
        userId: item.userId,
        value: item.currentValue,
        targetReachedAt: item.targetReachedAt,
      })),
    });
    const terminal = ["COMPLETED", "EXPIRED"].includes(resolution.status);
    const updated = await tx.challenge.update({
      where: { id: challenge.id },
      data: {
        status: resolution.status,
        winnerId: resolution.winnerId,
        resolvedAt: terminal ? (challenge.resolvedAt ?? now) : null,
      },
    });
    if (terminal) {
      for (const item of calculated)
        await tx.challengeProgress.update({
          where: { id: item.id },
          data: { finalValue: item.currentValue },
        });
    } else {
      await tx.challengeProgress.updateMany({
        where: { challengeId: challenge.id },
        data: { finalValue: null },
      });
    }
    await syncChallengeBadges(tx, updated, calculated);
    return {
      challenge: updated,
      progress: calculated,
      changed: before.status !== updated.status || before.winnerId !== updated.winnerId,
    };
  });
  if (result?.changed && ["COMPLETED", "EXPIRED"].includes(result.challenge.status)) {
    for (const userId of [result.challenge.creatorId, result.challenge.opponentId]) {
      const expired = result.challenge.status === "EXPIRED";
      const title = expired
        ? "Challenge window closed"
        : result.challenge.winnerId
          ? result.challenge.winnerId === userId
            ? "Challenge complete: you led the eligible total"
            : "Challenge complete"
          : "Challenge complete: draw";
      await createNotification({
        userId,
        type: "CHALLENGE_RESOLVED",
        title,
        body: expired
          ? "The target was not reached before the deadline. Review the eligible progress and adjustments."
          : "Review the final eligible progress, event adjustments, and earned badges.",
        actionUrl: `/challenges/${result.challenge.id}/result`,
        preference: "challengeNotifications",
        email: true,
      });
    }
  }
  return result;
}

export async function recalculateChallengesForUser(userId: string, now = new Date()) {
  const challenges = await prisma.challenge.findMany({
    where: {
      acceptedAt: { not: null },
      status: { in: ["SCHEDULED", "ACTIVE", "COMPLETED", "EXPIRED"] },
      OR: [{ creatorId: userId }, { opponentId: userId }],
    },
    select: { id: true },
  });
  for (const challenge of challenges) await reconcileChallenge(challenge.id, now);
  return challenges.length;
}

export async function runChallengeLifecycle(now = new Date()) {
  const challenges = await prisma.challenge.findMany({
    where: {
      acceptedAt: { not: null },
      status: { in: ["SCHEDULED", "ACTIVE", "COMPLETED", "EXPIRED"] },
    },
    select: { id: true },
  });
  for (const challenge of challenges) await reconcileChallenge(challenge.id, now);
  return { challengesChecked: challenges.length };
}
