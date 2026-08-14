import { prisma } from "@/lib/db/prisma";
import { canManagePair } from "@/lib/social/pairs";
import { accountabilityPatchSchema } from "@/lib/social/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
export async function PATCH(request: Request, context: { params: Promise<{ pairId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = accountabilityPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const { pairId } = await context.params;
  const pair = await prisma.accountabilityPair.findUnique({ where: { id: pairId } });
  if (!pair || !canManagePair(pair, user.id) || !["ACTIVE", "PAUSED"].includes(pair.status))
    return notFound();
  return Response.json({
    pair: await prisma.accountabilityPair.update({
      where: { id: pair.id },
      data: { status: parsed.data.status },
    }),
  });
}
export async function DELETE(_request: Request, context: { params: Promise<{ pairId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { pairId } = await context.params;
  const pair = await prisma.accountabilityPair.findUnique({ where: { id: pairId } });
  if (!pair || !canManagePair(pair, user.id)) return notFound();
  await prisma.accountabilityPair.update({
    where: { id: pair.id },
    data: { status: "ENDED", endedAt: new Date() },
  });
  return new Response(null, { status: 204 });
}
