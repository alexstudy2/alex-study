-- AI Exam Plan: what the plan is made of -- study then revise, study only, or revision only.

CREATE TYPE "ExamStudyMode" AS ENUM ('STUDY_AND_REVIEW', 'STUDY_ONLY', 'REVIEW_ONLY');

-- The default is what every existing proposal already is: a plan that studies each topic and then
-- revises it. So no backfill, and a plan generated before this column existed still reads truthfully.
ALTER TABLE "ExamPlan"
  ADD COLUMN "studyMode" "ExamStudyMode" NOT NULL DEFAULT 'STUDY_AND_REVIEW';
