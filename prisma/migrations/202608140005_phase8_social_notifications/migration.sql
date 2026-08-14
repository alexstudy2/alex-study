CREATE TYPE "AccountabilityStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ENDED', 'DECLINED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

ALTER TABLE "Friendship" ADD COLUMN "pairKey" TEXT;
ALTER TABLE "Friendship" ADD COLUMN "blockedById" TEXT;
UPDATE "Friendship"
SET "pairKey" = CASE
  WHEN "requesterId" < "addresseeId" THEN "requesterId" || ':' || "addresseeId"
  ELSE "addresseeId" || ':' || "requesterId"
END;
ALTER TABLE "Friendship" ALTER COLUMN "pairKey" SET NOT NULL;
CREATE UNIQUE INDEX "Friendship_pairKey_key" ON "Friendship"("pairKey");
CREATE INDEX "Friendship_requesterId_status_idx" ON "Friendship"("requesterId", "status");
CREATE INDEX "Friendship_addresseeId_status_idx" ON "Friendship"("addresseeId", "status");

CREATE TABLE "AccountabilityPair" (
  "id" TEXT NOT NULL,
  "userAId" TEXT NOT NULL,
  "userBId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "status" "AccountabilityStatus" NOT NULL DEFAULT 'PENDING',
  "lastReminderAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountabilityPair_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountabilityPair_pairKey_key" ON "AccountabilityPair"("pairKey");
CREATE INDEX "AccountabilityPair_userAId_status_idx" ON "AccountabilityPair"("userAId", "status");
CREATE INDEX "AccountabilityPair_userBId_status_idx" ON "AccountabilityPair"("userBId", "status");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "actionUrl" TEXT,
  "metadata" JSONB,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");

CREATE TABLE "AccountabilityCheck" (
  "id" TEXT NOT NULL,
  "pairId" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "notificationId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountabilityCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountabilityCheck_pairId_sentAt_idx" ON "AccountabilityCheck"("pairId", "sentAt");
CREATE INDEX "AccountabilityCheck_subjectUserId_sentAt_idx" ON "AccountabilityCheck"("subjectUserId", "sentAt");

ALTER TABLE "AccountabilityPair" ADD CONSTRAINT "AccountabilityPair_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountabilityPair" ADD CONSTRAINT "AccountabilityPair_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountabilityPair" ADD CONSTRAINT "AccountabilityPair_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountabilityCheck" ADD CONSTRAINT "AccountabilityCheck_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "AccountabilityPair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountabilityCheck" ADD CONSTRAINT "AccountabilityCheck_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountabilityCheck" ADD CONSTRAINT "AccountabilityCheck_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
