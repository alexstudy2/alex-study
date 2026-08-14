ALTER TYPE "ChallengeStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TYPE "ChallengeStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "ChallengeEventType" AS ENUM ('SOURCE', 'ADJUSTMENT');
CREATE TYPE "ChallengeSourceType" AS ENUM ('TASK', 'STUDY_SESSION');
CREATE TYPE "LeaderboardScope" AS ENUM ('ALL_COLLEGE', 'FRIENDS');
CREATE TYPE "LeaderboardMetric" AS ENUM ('STUDY_MINUTES', 'TASKS_COMPLETED');

ALTER TABLE "Challenge" ADD COLUMN "shareEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Challenge" ADD COLUMN "subjectKey" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "subjectLabel" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Challenge" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Challenge" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Challenge" ADD COLUMN "rematchOfId" TEXT;
ALTER TABLE "ChallengeProgress" ADD COLUMN "finalValue" INTEGER;

UPDATE "Challenge"
SET "subjectKey" = "Subject"."normalizedName", "subjectLabel" = "Subject"."name"
FROM "Subject"
WHERE "Challenge"."subjectId" = "Subject"."id";

UPDATE "Challenge" SET "acceptedAt" = "createdAt" WHERE "status" IN ('ACTIVE', 'COMPLETED');
UPDATE "Challenge" SET "resolvedAt" = "updatedAt" WHERE "status" = 'COMPLETED';

CREATE INDEX "Challenge_creatorId_status_createdAt_idx" ON "Challenge"("creatorId", "status", "createdAt");
CREATE INDEX "Challenge_opponentId_status_createdAt_idx" ON "Challenge"("opponentId", "status", "createdAt");
CREATE INDEX "Challenge_status_startsAt_endsAt_idx" ON "Challenge"("status", "startsAt", "endsAt");
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_rematchOfId_fkey" FOREIGN KEY ("rematchOfId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChallengeProgressEvent" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "progressId" TEXT NOT NULL,
  "sourceType" "ChallengeSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventType" "ChallengeEventType" NOT NULL DEFAULT 'SOURCE',
  "deltaValue" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChallengeProgressEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeProgressEvent_idempotencyKey_key" ON "ChallengeProgressEvent"("idempotencyKey");
CREATE INDEX "ChallengeProgressEvent_challengeId_occurredAt_idx" ON "ChallengeProgressEvent"("challengeId", "occurredAt");
CREATE INDEX "ChallengeProgressEvent_progressId_sourceType_sourceId_idx" ON "ChallengeProgressEvent"("progressId", "sourceType", "sourceId");
ALTER TABLE "ChallengeProgressEvent" ADD CONSTRAINT "ChallengeProgressEvent_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeProgressEvent" ADD CONSTRAINT "ChallengeProgressEvent_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "ChallengeProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BadgeDefinition" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "iconKey" TEXT NOT NULL,
  "criteria" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BadgeDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BadgeDefinition_key_key" ON "BadgeDefinition"("key");

CREATE TABLE "UserBadge" (
  "id" TEXT NOT NULL,
  "awardKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "badgeId" TEXT NOT NULL,
  "challengeId" TEXT,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserBadge_awardKey_key" ON "UserBadge"("awardKey");
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_challengeId_key" ON "UserBadge"("userId", "badgeId", "challengeId");
CREATE INDEX "UserBadge_userId_awardedAt_idx" ON "UserBadge"("userId", "awardedAt");
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "BadgeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeaderboardSnapshot" (
  "id" TEXT NOT NULL,
  "snapshotKey" TEXT NOT NULL,
  "scope" "LeaderboardScope" NOT NULL,
  "ownerUserId" TEXT,
  "academicYear" INTEGER,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metric" "LeaderboardMetric" NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaderboardSnapshot_snapshotKey_key" ON "LeaderboardSnapshot"("snapshotKey");
CREATE INDEX "LeaderboardSnapshot_scope_metric_periodStart_idx" ON "LeaderboardSnapshot"("scope", "metric", "periodStart");
CREATE INDEX "LeaderboardSnapshot_ownerUserId_metric_periodStart_idx" ON "LeaderboardSnapshot"("ownerUserId", "metric", "periodStart");
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeaderboardEntry" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "value" INTEGER NOT NULL,
  "secondaryValue" INTEGER,
  CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaderboardEntry_snapshotId_userId_key" ON "LeaderboardEntry"("snapshotId", "userId");
CREATE INDEX "LeaderboardEntry_snapshotId_rank_idx" ON "LeaderboardEntry"("snapshotId", "rank");
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "LeaderboardSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
