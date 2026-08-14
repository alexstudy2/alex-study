import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      collegeId: true,
      academicYear: true,
      email: true,
      aiNudgesEnabled: true,
      leaderboardVisible: true,
      profileVisibility: true,
      preference: true,
    },
  });
  if (!profile) return null;
  return <SettingsWorkspace initial={profile} locale={user.locale === "AR" ? "ar" : "en"} />;
}
