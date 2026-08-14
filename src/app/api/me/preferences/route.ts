import { prisma } from "@/lib/db/prisma";
import { studyPreferencesSchema } from "@/lib/settings/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function PATCH(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = studyPreferencesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const preference = await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });
  return Response.json({ preference });
}
