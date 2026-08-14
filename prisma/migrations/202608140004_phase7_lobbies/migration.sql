ALTER TABLE "TimerRun" ADD COLUMN "roomId" TEXT;
ALTER TABLE "TimerRun" ADD COLUMN "hostUserId" TEXT;

CREATE TABLE "RoomMessage" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionReaction" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "roomId" TEXT,
  "senderId" TEXT NOT NULL,
  "reaction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimerRun_roomId_status_idx" ON "TimerRun"("roomId", "status");
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "RoomMessage"("roomId", "createdAt");
CREATE UNIQUE INDEX "SessionReaction_sessionId_senderId_reaction_key" ON "SessionReaction"("sessionId", "senderId", "reaction");
CREATE INDEX "SessionReaction_roomId_createdAt_idx" ON "SessionReaction"("roomId", "createdAt");
CREATE UNIQUE INDEX "TimerRun_one_open_per_room" ON "TimerRun"("roomId") WHERE "roomId" IS NOT NULL AND "status" IN ('RUNNING', 'PAUSED');

ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimerRun" ADD CONSTRAINT "TimerRun_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionReaction" ADD CONSTRAINT "SessionReaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionReaction" ADD CONSTRAINT "SessionReaction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionReaction" ADD CONSTRAINT "SessionReaction_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
