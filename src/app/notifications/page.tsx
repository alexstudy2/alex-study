import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { NotificationCenter } from "@/components/notifications/notification-center";
export default async function NotificationsPage() {
  const user = await requireUser();
  const [items, p] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <NotificationCenter
      initialItems={items}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      preferences={{
        emailNotifications: p?.emailNotifications ?? true,
        inAppNotifications: p?.inAppNotifications ?? true,
        accountabilityNotifications: p?.accountabilityNotifications ?? true,
        challengeNotifications: p?.challengeNotifications ?? true,
        aiInsightNotifications: p?.aiInsightNotifications ?? true,
      }}
    />
  );
}
