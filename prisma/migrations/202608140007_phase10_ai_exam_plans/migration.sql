CREATE TYPE "AIJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ExamPlanStatus" AS ENUM ('GENERATING', 'PROPOSED', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'REJECTED');

CREATE TABLE "AIJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" "AIJobStatus" NOT NULL DEFAULT 'QUEUED',
  "inputHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 2,
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "errorCode" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIJob_jobKey_key" ON "AIJob"("jobKey");
CREATE INDEX "AIJob_userId_type_createdAt_idx" ON "AIJob"("userId", "type", "createdAt");
CREATE INDEX "AIJob_status_createdAt_idx" ON "AIJob"("status", "createdAt");
ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIInsight" ADD COLUMN "aiJobId" TEXT;
CREATE UNIQUE INDEX "AIInsight_aiJobId_key" ON "AIInsight"("aiJobId");
CREATE INDEX "AIInsight_userId_type_createdAt_idx" ON "AIInsight"("userId", "type", "createdAt");
ALTER TABLE "AIInsight" ADD CONSTRAINT "AIInsight_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExamPlan" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "aiJobId" TEXT,
  "inputHash" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "overview" TEXT,
  "examAt" TIMESTAMP(3) NOT NULL,
  "syllabusText" TEXT,
  "status" "ExamPlanStatus" NOT NULL DEFAULT 'GENERATING',
  "locale" "AppLocale" NOT NULL DEFAULT 'EN',
  "model" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "contextPurgeAt" TIMESTAMP(3) NOT NULL,
  "contextPurgedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamPlan_aiJobId_key" ON "ExamPlan"("aiJobId");
CREATE INDEX "ExamPlan_userId_status_createdAt_idx" ON "ExamPlan"("userId", "status", "createdAt");
CREATE INDEX "ExamPlan_userId_inputHash_createdAt_idx" ON "ExamPlan"("userId", "inputHash", "createdAt");
ALTER TABLE "ExamPlan" ADD CONSTRAINT "ExamPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlan" ADD CONSTRAINT "ExamPlan_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExamPlanItem" (
  "id" TEXT NOT NULL,
  "examPlanId" TEXT NOT NULL,
  "subjectId" TEXT,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "plannedDate" TIMESTAMP(3) NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "accepted" BOOLEAN NOT NULL DEFAULT false,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdTaskId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamPlanItem_createdTaskId_key" ON "ExamPlanItem"("createdTaskId");
CREATE INDEX "ExamPlanItem_examPlanId_sortOrder_idx" ON "ExamPlanItem"("examPlanId", "sortOrder");
ALTER TABLE "ExamPlanItem" ADD CONSTRAINT "ExamPlanItem_examPlanId_fkey" FOREIGN KEY ("examPlanId") REFERENCES "ExamPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamPlanItem" ADD CONSTRAINT "ExamPlanItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamPlanItem" ADD CONSTRAINT "ExamPlanItem_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceUsageLog" ADD COLUMN "userId" TEXT;
ALTER TABLE "ServiceUsageLog" ADD COLUMN "aiJobId" TEXT;
ALTER TABLE "ServiceUsageLog" ADD COLUMN "model" TEXT;
ALTER TABLE "ServiceUsageLog" ADD COLUMN "inputUnits" INTEGER;
ALTER TABLE "ServiceUsageLog" ADD COLUMN "outputUnits" INTEGER;
CREATE INDEX "ServiceUsageLog_userId_service_occurredAt_idx" ON "ServiceUsageLog"("userId", "service", "occurredAt");
CREATE INDEX "ServiceUsageLog_aiJobId_occurredAt_idx" ON "ServiceUsageLog"("aiJobId", "occurredAt");
ALTER TABLE "ServiceUsageLog" ADD CONSTRAINT "ServiceUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceUsageLog" ADD CONSTRAINT "ServiceUsageLog_aiJobId_fkey" FOREIGN KEY ("aiJobId") REFERENCES "AIJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
