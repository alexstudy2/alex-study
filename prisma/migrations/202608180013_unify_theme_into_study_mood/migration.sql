-- Unify the two parallel theming systems into one: the 5 Study Moods.
-- The old Theme enum (SYSTEM/LIGHT/DARK/GIRLY) drove core colour tokens while the moods
-- only drove a decorative background, which let users pick conflicting combinations.

CREATE TYPE "StudyMood" AS ENUM ('NOTEBOOK', 'SAKURA', 'COSMIC', 'AURORA', 'SUNSET');

ALTER TABLE "UserPreference" ADD COLUMN "studyMood" "StudyMood" NOT NULL DEFAULT 'NOTEBOOK';

-- Carry every existing choice across rather than resetting everyone to the default.
-- Cast through text so this still runs if the deployed enum lacks 'GIRLY'.
UPDATE "UserPreference" SET "studyMood" = CASE "theme"::text
    WHEN 'DARK' THEN 'COSMIC'::"StudyMood"
    WHEN 'GIRLY' THEN 'SAKURA'::"StudyMood"
    ELSE 'NOTEBOOK'::"StudyMood"
  END;

ALTER TABLE "UserPreference" DROP COLUMN "theme";

DROP TYPE "Theme";
