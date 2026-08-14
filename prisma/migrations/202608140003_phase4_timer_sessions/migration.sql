CREATE TYPE "TimerMode" AS ENUM ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK');
CREATE TYPE "TimerStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "StudySession" ADD COLUMN "reflection" TEXT;

CREATE TABLE "TimerRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "taskId" TEXT,
    "subjectId" TEXT,
    "mode" "TimerMode" NOT NULL,
    "status" "TimerStatus" NOT NULL DEFAULT 'RUNNING',
    "durationSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "segmentStartedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "accumulatedActiveSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimerRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionDistraction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "SessionDistraction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimerRun_sessionId_key" ON "TimerRun"("sessionId");
CREATE INDEX "TimerRun_userId_status_idx" ON "TimerRun"("userId", "status");
CREATE INDEX "TimerRun_userId_startedAt_idx" ON "TimerRun"("userId", "startedAt");
CREATE INDEX "SessionDistraction_sessionId_occurredAt_idx" ON "SessionDistraction"("sessionId", "occurredAt");
CREATE UNIQUE INDEX "TimerRun_one_open_per_user" ON "TimerRun"("userId") WHERE "status" IN ('RUNNING', 'PAUSED');

ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SessionDistraction" ADD CONSTRAINT "SessionDistraction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
