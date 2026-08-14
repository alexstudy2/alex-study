import { prisma } from "@/lib/db/prisma";
import { privacySchema } from "@/lib/challenges/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
export async function PATCH(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = privacySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  if (parsed.data.leaderboardVisible !== undefined || parsed.data.profileVisibility !== undefined)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        leaderboardVisible: parsed.data.leaderboardVisible,
        profileVisibility: parsed.data.profileVisibility,
      },
    });
  const preference =
    parsed.data.shareFullNameOnCards === undefined
      ? null
      : await prisma.userPreference.upsert({
          where: { userId: user.id },
          update: { shareFullNameOnCards: parsed.data.shareFullNameOnCards },
          create: { userId: user.id, shareFullNameOnCards: parsed.data.shareFullNameOnCards },
        });
  return Response.json({
    leaderboardVisible: parsed.data.leaderboardVisible,
    profileVisibility: parsed.data.profileVisibility,
    preference,
  });
}
