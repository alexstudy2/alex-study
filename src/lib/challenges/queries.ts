export const challengeInclude = {
  creator: {
    select: { id: true, name: true, academicYear: true, imageUrl: true },
  },
  opponent: {
    select: { id: true, name: true, academicYear: true, imageUrl: true },
  },
  winner: { select: { id: true, name: true, academicYear: true } },
  subject: { select: { id: true, name: true, normalizedName: true } },
  progress: {
    include: { user: { select: { id: true, name: true, academicYear: true } } },
    orderBy: { userId: "asc" as const },
  },
  badgeAwards: {
    include: { badge: true, user: { select: { id: true, name: true } } },
    orderBy: { awardedAt: "asc" as const },
  },
};

export function isChallengeParticipant(
  challenge: { creatorId: string; opponentId: string },
  userId: string,
) {
  return challenge.creatorId === userId || challenge.opponentId === userId;
}
