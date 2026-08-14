-- Phase 11: persist scheduler cursors so bounded jobs advance through all eligible users.
CREATE TABLE "ScheduledJobCursor" (
    "jobName" TEXT NOT NULL,
    "cursor" TEXT,
    "cycleCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduledJobCursor_pkey" PRIMARY KEY ("jobName")
);
