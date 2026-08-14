import { prisma } from "@/lib/db/prisma";
import { aiPreferenceSchema } from "@/lib/insights/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function PATCH(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = aiPreferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  await prisma.user.update({
    where: { id: user.id },
    data: { aiNudgesEnabled: parsed.data.enabled },
  });
  return Response.json({ enabled: parsed.data.enabled });
}
