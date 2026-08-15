ALTER TABLE "RoomMember"
ADD COLUMN "lobbyTaskTitle" TEXT,
ADD COLUMN "lobbyTaskCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lobbyTaskUpdatedAt" TIMESTAMP(3);
