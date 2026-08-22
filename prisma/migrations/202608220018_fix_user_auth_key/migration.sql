-- Auth-key reconciliation (REMEDIATION_PLAN.md T1.5 / audit H2).
-- The phase2_foundation migration created a globally-unique index on collegeId, while
-- schema.prisma has always declared the intended compound key (collegeId, academicYear).
-- The global index forbids re-enrolment (same college ID in a later year) and makes
-- migrate-deploy databases differ from db-push databases.
--
-- Introspection during remediation found that THIS database already carries only the
-- compound key (it was built by db push), while a fresh `migrate deploy` from history
-- would produce the global one. Both statements below are therefore conditional:
-- dropping the global key only where it exists and creating the compound key only
-- where it is missing -- a no-op here, a real repair on history-built databases.
-- Safe by construction: every row satisfying the stricter global uniqueness trivially
-- satisfies the compound one.
-- Rollback note: `CREATE UNIQUE INDEX "User_collegeId_key" ON "User"("collegeId");`
-- (fails if duplicate collegeIds exist, which is the point of this migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_collegeId_key') THEN
    DROP INDEX "User_collegeId_key";
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_collegeId_academicYear_key"
  ON "User"("collegeId", "academicYear");
