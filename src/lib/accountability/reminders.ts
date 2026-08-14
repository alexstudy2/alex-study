import { subHours } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";

export const ACCOUNTABILITY_INACTIVITY_HOURS = 24;
export const ACCOUNTABILITY_REMINDER_CAP_HOURS = 24;

export function isReminderEligible(input: {
  now: Date;
  lastStudyAt: Date | null;
  lastReminderAt: Date | null;
}) {
  const inactivityCutoff = subHours(input.now, ACCOUNTABILITY_INACTIVITY_HOURS);
  const reminderCutoff = subHours(input.now, ACCOUNTABILITY_REMINDER_CAP_HOURS);
  return (
    (!input.lastStudyAt || input.lastStudyAt <= inactivityCutoff) &&
    (!input.lastReminderAt || input.lastReminderAt <= reminderCutoff)
  );
}

export async function runAccountabilityReminders(now = new Date()) {
  const pairs = await prisma.accountabilityPair.findMany({
    where: { status: "ACTIVE" },
    include: {
      userA: { include: { preference: true } },
      userB: { include: { preference: true } },
    },
  });
  let sent = 0;
  for (const pair of pairs) {
    const users = [pair.userA, pair.userB];
    for (const subject of users) {
      const recipient = subject.id === pair.userAId ? pair.userB : pair.userA;
      if (
        subject.preference?.accountabilityNotifications === false ||
        recipient.preference?.accountabilityNotifications === false
      )
        continue;
      const lastSession = await prisma.studySession.findFirst({
        where: { userId: subject.id, status: "COMPLETED" },
        orderBy: { endedAt: "desc" },
        select: { endedAt: true, startedAt: true },
      });
      const lastCheck = await prisma.accountabilityCheck.findFirst({
        where: { pairId: pair.id, subjectUserId: subject.id },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      });
      if (
        !isReminderEligible({
          now,
          lastStudyAt: lastSession?.endedAt ?? lastSession?.startedAt ?? null,
          lastReminderAt: lastCheck?.sentAt ?? null,
        })
      )
        continue;
      const title = `${subject.name} may appreciate a check-in`;
      const body = `${subject.name} has not recorded a completed study session in the last 24 hours. Keep it supportive and low-pressure.`;
      const notification = await createNotification({
        userId: recipient.id,
        type: "ACCOUNTABILITY_REMINDER",
        title,
        body,
        actionUrl: "/friends",
        email: true,
        metadata: { pairId: pair.id, subjectUserId: subject.id },
      });
      await prisma.accountabilityCheck.create({
        data: {
          pairId: pair.id,
          subjectUserId: subject.id,
          recipientUserId: recipient.id,
          reason: "NO_COMPLETED_SESSION_24H",
          deliveryStatus: notification ? "SENT" : "SKIPPED",
          notificationId: notification?.id,
          sentAt: now,
        },
      });
      sent += notification ? 1 : 0;
    }
    await prisma.accountabilityPair.update({
      where: { id: pair.id },
      data: { lastReminderAt: now },
    });
  }
  return { pairsChecked: pairs.length, remindersSent: sent };
}
