-- Session revocation support (REMEDIATION_PLAN.md T1.4 / audit H4).
-- Purely additive: an indexed-by-PK integer defaulting to 0, so the ALTER is instant and
-- non-blocking on PostgreSQL 11+. Bumped on password reset; JWTs carry the value they
-- were issued with and apiUser() rejects mismatches.
-- Rollback note: `ALTER TABLE "User" DROP COLUMN "sessionVersion";` (only after reverting
-- the code that reads it).
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
