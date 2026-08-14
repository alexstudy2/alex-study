import type { Prisma, NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { sendNotificationEmail } from "@/lib/email/mailer";

type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
  email?: boolean;
  preference?: "challengeNotifications" | "aiInsightNotifications";
};

export async function createNotification(input: NotificationInput) {
  const recipient = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, preference: true },
  });
  if (!recipient) return null;
  if (input.preference && recipient.preference?.[input.preference] === false) return null;

  const inApp = recipient.preference?.inAppNotifications ?? true;
  const email = Boolean(input.email && recipient.preference?.emailNotifications !== false);
  if (!inApp && !email) return null;

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      metadata: input.metadata,
      deliveries: inApp
        ? { create: { channel: "IN_APP", status: "SENT", sentAt: new Date() } }
        : undefined,
    },
  });

  if (email)
    await deliverEmail(notification.id, recipient.email, input.title, input.body, input.actionUrl);
  return notification;
}

async function deliverEmail(
  notificationId: string,
  email: string | null,
  title: string,
  body: string,
  actionUrl?: string,
) {
  let status: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
  let failureReason: string | undefined = email ? undefined : "missing_email";
  if (email) {
    try {
      const result = await sendNotificationEmail(email, title, body, actionUrl);
      status = result.delivered ? "SENT" : "SKIPPED";
      failureReason = result.delivered ? undefined : result.reason;
    } catch {
      status = "FAILED";
      failureReason = "smtp_error";
    }
  }
  await prisma.notificationDelivery.create({
    data: {
      notificationId,
      channel: "EMAIL" satisfies NotificationChannel,
      status,
      sentAt: status === "SENT" ? new Date() : undefined,
      failureReason,
    },
  });
}
