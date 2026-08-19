-- AI Exam Plan: structured topic intake, a question-solving strategy, and publication to the forum.

CREATE TYPE "ExamQuestionStrategy" AS ENUM ('DEDICATED_DAYS', 'INTEGRATED');
CREATE TYPE "ExamPlanItemKind" AS ENUM ('STUDY', 'QUESTIONS', 'REVIEW');

-- Every column carries a default, so existing proposals need no backfill: they read as INTEGRATED
-- plans of all-STUDY items, which is what they are.
ALTER TABLE "ExamPlan"
  ADD COLUMN "questionStrategy" "ExamQuestionStrategy" NOT NULL DEFAULT 'INTEGRATED',
  ADD COLUMN "dailyCapacityMinutes" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN "studyPlanId" TEXT;

CREATE UNIQUE INDEX "ExamPlan_studyPlanId_key" ON "ExamPlan"("studyPlanId");
ALTER TABLE "ExamPlan" ADD CONSTRAINT "ExamPlan_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExamPlanItem"
  ADD COLUMN "kind" "ExamPlanItemKind" NOT NULL DEFAULT 'STUDY';
