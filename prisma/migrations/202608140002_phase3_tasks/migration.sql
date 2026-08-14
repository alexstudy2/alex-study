CREATE TYPE "TaskDraftStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

ALTER TABLE "Task"
ADD COLUMN "recurrenceSourceId" TEXT,
ADD COLUMN "recurrenceDate" TIMESTAMP(3);

CREATE TABLE "TaskDraft" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "subjectId" TEXT,
  "subjectName" TEXT,
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "dueAt" TIMESTAMP(3),
  "estimatedMinutes" INTEGER,
  "recurrenceRule" JSONB,
  "status" "TaskDraftStatus" NOT NULL DEFAULT 'PENDING',
  "model" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "TaskDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_userId_deletedAt_sortOrder_idx" ON "Task"("userId", "deletedAt", "sortOrder");
CREATE UNIQUE INDEX "Task_recurrenceSourceId_recurrenceDate_key" ON "Task"("recurrenceSourceId", "recurrenceDate");
CREATE INDEX "TaskDraft_userId_status_expiresAt_idx" ON "TaskDraft"("userId", "status", "expiresAt");

ALTER TABLE "Task" ADD CONSTRAINT "Task_recurrenceSourceId_fkey" FOREIGN KEY ("recurrenceSourceId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TaskDraft" ADD CONSTRAINT "TaskDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
