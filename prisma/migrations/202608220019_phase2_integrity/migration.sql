-- Phase 2 data-integrity batch (REMEDIATION_PLAN T2.1/T2.2/T2.3 + deferred halves of
-- T3.5/T3.6). Applied after a full Prisma JSON snapshot (backups/), per plan ground rules.
-- All statements are online-safe: constraint rewrites and additive indexes only, plus one
-- DROP of a table written by nobody (DailyUserMetric, audit L18/D4).
-- Rollback note: restore from the pre-apply snapshot; no down-script is provided for the
-- DailyUserMetric drop (it had zero rows).

-- ============ T2.1 / H5: account deletion must not destroy friends' shared history ====
-- FRIENDS snapshots are persisted per generating user; Cascade let `prisma.user.delete`
-- take other users' leaderboard entries with it.
ALTER TABLE "LeaderboardSnapshot" DROP CONSTRAINT "LeaderboardSnapshot_ownerUserId_fkey";
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ T2.1 / H6: room deletion must not destroy members' timer runs ===========
-- Mirrors StudySession.room (already SetNull): a member's timer history is theirs, not
-- the room owner's, and an owner deleting their account was killing live timers.
ALTER TABLE "TimerRun" DROP CONSTRAINT "TimerRun_roomId_fkey";
ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============ T3.6b / M9: durable one-live-challenge-per-pair =========================
-- Canonical sorted-pair key backfilled from existing rows (matches canonicalPair() in
-- src/lib/social/pairs.ts). The uniqueness itself is PARTIAL -- invisible to schema.prisma
-- by design, exactly like TimerRun_one_open_per_user/_per_room in phase11_hardening:
-- never `db push` against an environment relying on it without diffing first.
ALTER TABLE "Challenge" ADD COLUMN "pairKey" TEXT;
UPDATE "Challenge"
SET "pairKey" = CASE WHEN "creatorId" < "opponentId"
    THEN "creatorId" || ':' || "opponentId"
    ELSE "opponentId" || ':' || "creatorId" END;
CREATE INDEX "Challenge_pairKey_idx" ON "Challenge"("pairKey");
CREATE UNIQUE INDEX "Challenge_one_live_per_pair" ON "Challenge"("pairKey")
  WHERE "status" IN ('PENDING', 'SCHEDULED', 'ACTIVE');

-- ============ T2.3 / L14: hot-path index gaps =========================================
-- Goal progress, analytics windows, AI signal scans all filter userId + completedAt.
CREATE INDEX "Task_userId_completedAt_idx" ON "Task"("userId", "completedAt");
-- Notification list orders by createdAt alone; the readAt composite cannot serve it.
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- ============ T2.2 / H7 (+L15): purge-predicate support ===============================
CREATE INDEX "RoomMessage_createdAt_idx" ON "RoomMessage"("createdAt");
CREATE INDEX "TaskDraft_expiresAt_idx" ON "TaskDraft"("expiresAt");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "AccountabilityCheck_sentAt_idx" ON "AccountabilityCheck"("sentAt");

-- ============ D4 / L18: dead table =====================================================
DROP TABLE "DailyUserMetric";
