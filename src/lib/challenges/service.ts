import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { challengeInclude } from "@/lib/challenges/queries";
import { reconcileChallenge } from "@/lib/challenges/engine";
import { publicName } from "@/lib/challenges/rules";
import { canonicalPair } from "@/lib/social/pairs";
import type { challengeInputSchema } from "@/lib/challenges/validation";

type ChallengeInput = z.infer<typeof challengeInputSchema>;
type ChallengeActor = { id: string; name?: string | null };
type CreateChallengeOptions = {
  rematchOfId?: string;
  subjectSnapshot?: { key: string; label: string };
};

export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

export async function createChallenge(
  user: ChallengeActor,
  input: ChallengeInput,
  options: CreateChallengeOptions = {},
) {
  if (input.opponentId === user.id) return { error: "self_challenge" as const };
  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: user.id, addresseeId: input.opponentId },
        { requesterId: input.opponentId, addresseeId: user.id },
      ],
    },
  });
  if (!friendship) return { error: "opponent_not_friend" as const };
  const subjectType = input.type.startsWith("SUBJECT_");
  const subject =
    subjectType && input.subjectId
      ? await prisma.subject.findFirst({
          where: { id: input.subjectId, userId: user.id, archivedAt: null },
        })
      : null;
  const subjectKey = subject?.normalizedName ?? options.subjectSnapshot?.key ?? null;
  const subjectLabel = subject?.name ?? options.subjectSnapshot?.label ?? null;
  if (subjectType && (!subjectKey || !subjectLabel)) return { error: "invalid_subject" as const };
  /* The one-live-challenge-per-pair rule used to be a bare probe-then-create (audit M9):
     two concurrent invites both passed the probe and both became ACTIVE. The probe and
     the create now share one serializable transaction -- the database serializes racing
     pairs, and a serialization retry (P2034) is reported as the same friendly conflict
     instead of double-spending an ACTIVE challenge into existence. The durable half of
     this fix (a partial unique index on live statuses) is deferred to the next migration
     batch; see REMEDIATION_PLAN.md T3.6. */
  let challenge;
  try {
    challenge = await prisma.$transaction(
      async (tx) => {
        const overlapping = await tx.challenge.findFirst({
          where: {
            status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] },
            OR: [
              { creatorId: user.id, opponentId: input.opponentId },
              { creatorId: input.opponentId, opponentId: user.id },
            ],
          },
          select: { id: true },
        });
        if (overlapping) return null;
        return tx.challenge.create({
          data: {
            creatorId: user.id,
            opponentId: input.opponentId,
            /* Durable half of one-live-per-pair (audit M9): the partial unique index
               `Challenge_one_live_per_pair` (migration SQL) enforces it at the database. */
            pairKey: canonicalPair(user.id, input.opponentId).pairKey,
            subjectId: subject?.id,
            subjectKey,
            subjectLabel,
            type: input.type,
            targetValue: input.targetValue,
            resolutionType: input.resolutionType,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            shareToken: newShareToken(),
            rematchOfId: options.rematchOfId,
            progress: {
              create: [{ userId: user.id }, { userId: input.opponentId }],
            },
          },
          include: challengeInclude,
        });
      },
      { isolationLevel: "Serializable", timeout: 15000, maxWait: 10000 },
    );
  } catch (error) {
    if ((error as { code?: string }).code === "P2034")
      return { error: "active_pair_challenge" as const };
    throw error;
  }
  if (!challenge) return { error: "active_pair_challenge" as const };
  await createNotification({
    userId: input.opponentId,
    type: "CHALLENGE_INVITE",
    title: `${user.name?.trim() || "A classmate"} invited you to a study challenge`,
    body: "Review the goal, eligibility rules, resolution mode, and duration before accepting.",
    actionUrl: `/challenges/${challenge.id}`,
    preference: "challengeNotifications",
    email: true,
  });
  return { challenge };
}

export async function acceptChallenge(challengeId: string, user: ChallengeActor) {
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, opponentId: user.id, status: "PENDING" },
  });
  if (!challenge) return null;
  const now = new Date();
  if (challenge.endsAt <= now) {
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: "EXPIRED", resolvedAt: now },
    });
    return null;
  }
  const duration = challenge.endsAt.getTime() - challenge.startsAt.getTime();
  const startsAt = challenge.startsAt <= now ? now : challenge.startsAt;
  const endsAt = challenge.startsAt <= now ? new Date(now.getTime() + duration) : challenge.endsAt;
  const updated = await prisma.challenge.update({
    where: { id: challenge.id },
    data: {
      acceptedAt: now,
      startsAt,
      endsAt,
      status: startsAt <= now ? "ACTIVE" : "SCHEDULED",
    },
  });
  await createNotification({
    userId: challenge.creatorId,
    type: "CHALLENGE_ACCEPTED",
    title: `${user.name?.trim() || "Your friend"} accepted your study challenge`,
    body:
      startsAt <= now ? "Eligible progress is now being tracked." : "The challenge is scheduled.",
    actionUrl: `/challenges/${challenge.id}`,
    preference: "challengeNotifications",
    email: true,
  });
  if (updated.status === "ACTIVE") await reconcileChallenge(updated.id, now);
  return updated;
}

export async function challengeStats(userId: string) {
  const whereParticipant = { OR: [{ creatorId: userId }, { opponentId: userId }] };
  const [active, completed, wins, draws, targetReached, badges] = await Promise.all([
    prisma.challenge.count({
      where: { ...whereParticipant, status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] } },
    }),
    prisma.challenge.count({
      where: {
        ...whereParticipant,
        acceptedAt: { not: null },
        status: { in: ["COMPLETED", "EXPIRED"] },
      },
    }),
    prisma.challenge.count({ where: { winnerId: userId, status: "COMPLETED" } }),
    prisma.challenge.count({
      where: {
        ...whereParticipant,
        acceptedAt: { not: null },
        status: "COMPLETED",
        winnerId: null,
      },
    }),
    prisma.challengeProgress.count({ where: { userId, targetReachedAt: { not: null } } }),
    prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
      orderBy: { awardedAt: "desc" },
    }),
  ]);
  return {
    active,
    completed,
    wins,
    draws,
    targetReached,
    winRate: completed ? Math.round((wins / completed) * 100) : 0,
    badges,
  };
}

export async function challengeHistory(userId: string, limit = 30) {
  return prisma.challenge.findMany({
    where: {
      OR: [{ creatorId: userId }, { opponentId: userId }],
      status: { in: ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"] },
    },
    include: challengeInclude,
    orderBy: { updatedAt: "desc" },
    take: Math.min(100, Math.max(1, limit)),
  });
}

export async function publicChallengeByToken(shareToken: string) {
  const challenge = await prisma.challenge.findFirst({
    where: {
      shareToken,
      shareEnabled: true,
      acceptedAt: { not: null },
      status: { in: ["COMPLETED", "EXPIRED"] },
    },
    include: {
      creator: { select: { name: true, academicYear: true, preference: true } },
      opponent: { select: { name: true, academicYear: true, preference: true } },
      progress: { orderBy: { userId: "asc" } },
    },
  });
  if (!challenge) return null;
  const winnerKey =
    challenge.winnerId === challenge.creatorId
      ? "creator"
      : challenge.winnerId === challenge.opponentId
        ? "opponent"
        : null;
  return {
    type: challenge.type,
    targetValue: challenge.targetValue,
    resolutionType: challenge.resolutionType,
    subjectLabel: challenge.subjectLabel,
    status: challenge.status,
    startsAt: challenge.startsAt,
    endsAt: challenge.endsAt,
    resolvedAt: challenge.resolvedAt,
    winnerKey,
    participants: [
      {
        key: "creator" as const,
        name: publicName(
          challenge.creator.name,
          challenge.creator.preference?.shareFullNameOnCards ?? false,
        ),
        academicYear: challenge.creator.academicYear,
        value:
          challenge.progress.find((item) => item.userId === challenge.creatorId)?.currentValue ?? 0,
      },
      {
        key: "opponent" as const,
        name: publicName(
          challenge.opponent.name,
          challenge.opponent.preference?.shareFullNameOnCards ?? false,
        ),
        academicYear: challenge.opponent.academicYear,
        value:
          challenge.progress.find((item) => item.userId === challenge.opponentId)?.currentValue ??
          0,
      },
    ],
  };
}
