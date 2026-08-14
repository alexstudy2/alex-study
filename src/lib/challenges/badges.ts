import type { Prisma } from "@prisma/client";

const badgeDefinitions = [
  {
    key: "CHALLENGE_FINISHER",
    name: "Challenge finisher",
    description: "Completed an accepted one-to-one challenge.",
    iconKey: "flag",
    criteria: { completedChallenges: 1 },
  },
  {
    key: "CHALLENGE_WINNER",
    name: "Challenge milestone",
    description: "Finished a challenge with the leading eligible total.",
    iconKey: "medal",
    criteria: { wins: 1 },
  },
  {
    key: "TARGET_REACHED",
    name: "Target reached",
    description: "Reached the agreed challenge target.",
    iconKey: "target",
    criteria: { reachedTarget: true },
  },
  {
    key: "CONSISTENT_CHALLENGER",
    name: "Steady challenger",
    description: "Completed five accepted one-to-one challenges.",
    iconKey: "trend-up",
    criteria: { completedChallenges: 5 },
  },
] as const;

export async function ensureBadgeDefinitions(tx: Prisma.TransactionClient) {
  for (const badge of badgeDefinitions) {
    await tx.badgeDefinition.upsert({
      where: { key: badge.key },
      update: {
        name: badge.name,
        description: badge.description,
        iconKey: badge.iconKey,
        criteria: badge.criteria,
      },
      create: badge,
    });
  }
}

export async function syncChallengeBadges(
  tx: Prisma.TransactionClient,
  challenge: {
    id: string;
    creatorId: string;
    opponentId: string;
    winnerId: string | null;
    acceptedAt: Date | null;
    status: string;
  },
  progress: Array<{ userId: string; targetReachedAt: Date | null }>,
) {
  await ensureBadgeDefinitions(tx);
  await tx.userBadge.deleteMany({ where: { challengeId: challenge.id } });
  if (!challenge.acceptedAt || !["COMPLETED", "EXPIRED"].includes(challenge.status)) return;
  const badges = await tx.badgeDefinition.findMany({
    where: { key: { in: ["CHALLENGE_FINISHER", "CHALLENGE_WINNER", "TARGET_REACHED"] } },
  });
  const byKey = new Map(badges.map((badge) => [badge.key, badge]));
  const awards: Array<{
    awardKey: string;
    userId: string;
    badgeId: string;
    challengeId: string;
  }> = [];
  for (const userId of [challenge.creatorId, challenge.opponentId]) {
    const finisher = byKey.get("CHALLENGE_FINISHER");
    if (finisher)
      awards.push({
        awardKey: `${userId}:${finisher.key}:${challenge.id}`,
        userId,
        badgeId: finisher.id,
        challengeId: challenge.id,
      });
    if (progress.find((item) => item.userId === userId)?.targetReachedAt) {
      const target = byKey.get("TARGET_REACHED");
      if (target)
        awards.push({
          awardKey: `${userId}:${target.key}:${challenge.id}`,
          userId,
          badgeId: target.id,
          challengeId: challenge.id,
        });
    }
  }
  if (challenge.winnerId) {
    const winner = byKey.get("CHALLENGE_WINNER");
    if (winner)
      awards.push({
        awardKey: `${challenge.winnerId}:${winner.key}:${challenge.id}`,
        userId: challenge.winnerId,
        badgeId: winner.id,
        challengeId: challenge.id,
      });
  }
  if (awards.length) await tx.userBadge.createMany({ data: awards, skipDuplicates: true });

  for (const userId of [challenge.creatorId, challenge.opponentId]) {
    const completed = await tx.challenge.count({
      where: {
        acceptedAt: { not: null },
        status: { in: ["COMPLETED", "EXPIRED"] },
        OR: [{ creatorId: userId }, { opponentId: userId }],
      },
    });
    if (completed >= 5) {
      const steady = await tx.badgeDefinition.findUnique({
        where: { key: "CONSISTENT_CHALLENGER" },
      });
      if (steady)
        await tx.userBadge.upsert({
          where: { awardKey: `${userId}:${steady.key}:global` },
          update: {},
          create: {
            awardKey: `${userId}:${steady.key}:global`,
            userId,
            badgeId: steady.id,
          },
        });
    } else {
      await tx.userBadge.deleteMany({
        where: { awardKey: `${userId}:CONSISTENT_CHALLENGER:global` },
      });
    }
  }
}
