-- Plan Forum: hand-built, day-keyed, shareable study plans.

CREATE TYPE "StudyPlanVisibility" AS ENUM ('PRIVATE', 'CLASS');

CREATE TABLE "StudyPlan" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "visibility" "StudyPlanVisibility" NOT NULL DEFAULT 'PRIVATE',
  "academicYear" INTEGER NOT NULL,
  "sharedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyPlan_authorId_updatedAt_idx" ON "StudyPlan"("authorId", "updatedAt");
CREATE INDEX "StudyPlan_visibility_academicYear_sharedAt_idx" ON "StudyPlan"("visibility", "academicYear", "sharedAt");
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudyPlanItem" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "dayDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "subjectLabel" TEXT NOT NULL,
  "subjectId" TEXT,
  "colorToken" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudyPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudyPlanItem_planId_dayDate_sortOrder_idx" ON "StudyPlanItem"("planId", "dayDate", "sortOrder");
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StudyPlanSave" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyPlanSave_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyPlanSave_userId_planId_key" ON "StudyPlanSave"("userId", "planId");
CREATE INDEX "StudyPlanSave_userId_createdAt_idx" ON "StudyPlanSave"("userId", "createdAt");
ALTER TABLE "StudyPlanSave" ADD CONSTRAINT "StudyPlanSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyPlanSave" ADD CONSTRAINT "StudyPlanSave_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
