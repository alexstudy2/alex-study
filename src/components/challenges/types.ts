export type ChallengePerson = {
  id: string;
  name: string;
  academicYear: number;
  imageUrl?: string | null;
};

export type ChallengeProgress = {
  id: string;
  userId: string;
  currentValue: number;
  finalValue: number | null;
  targetReachedAt: string | Date | null;
  user: ChallengePerson;
};

export type ChallengeBadgeAward = {
  id: string;
  userId: string;
  awardedAt: string | Date;
  user: Pick<ChallengePerson, "id" | "name">;
  badge: {
    id: string;
    key: string;
    name: string;
    description: string;
    iconKey: string;
  };
};

export type Challenge = {
  id: string;
  creatorId: string;
  opponentId: string;
  subjectId: string | null;
  subjectKey: string | null;
  subjectLabel: string | null;
  type: "TASK_COUNT" | "STUDY_TIME" | "SUBJECT_TASK_COUNT" | "SUBJECT_STUDY_TIME";
  targetValue: number;
  resolutionType: "TARGET_FIRST" | "DEADLINE_LEADER";
  startsAt: string | Date;
  endsAt: string | Date;
  status: string;
  winnerId: string | null;
  shareToken: string;
  shareEnabled: boolean;
  acceptedAt: string | Date | null;
  resolvedAt: string | Date | null;
  cancelledAt: string | Date | null;
  rematchOfId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  creator: ChallengePerson;
  opponent: ChallengePerson;
  winner: Pick<ChallengePerson, "id" | "name" | "academicYear"> | null;
  progress: ChallengeProgress[];
  badgeAwards: ChallengeBadgeAward[];
};

export type ChallengeEvent = {
  id: string;
  eventType: "SOURCE" | "ADJUSTMENT";
  sourceType: "TASK" | "STUDY_SESSION";
  deltaValue: number;
  occurredAt: string | Date;
  progress: { user: Pick<ChallengePerson, "id" | "name"> };
};

export type BadgeAward = {
  id: string;
  awardedAt: string | Date;
  badge: {
    key: string;
    name: string;
    description: string;
    iconKey: string;
  };
};

export type LeaderboardRow = {
  userId: string;
  name: string;
  academicYear: number;
  imageUrl: string | null;
  value: number;
  secondaryValue: number;
  rank: number;
};
