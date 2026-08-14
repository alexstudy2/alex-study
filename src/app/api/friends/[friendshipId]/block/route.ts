import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(
  _request: Request,
  context: { params: Promise<{ friendshipId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { friendshipId } = await context.params;
  const friendship = await prisma.friendship.findFirst({
    where: { id: friendshipId, OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
  });
  if (!friendship) return notFound();
  await prisma.$transaction([
    prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "BLOCKED", blockedById: user.id, respondedAt: new Date() },
    }),
    prisma.accountabilityPair.updateMany({
      where: { pairKey: friendship.pairKey, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
      data: { status: "ENDED", endedAt: new Date() },
    }),
  ]);
  return Response.json({ blocked: true });
}
