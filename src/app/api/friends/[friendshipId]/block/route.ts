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
  const now = new Date();
  const [userAId, userBId] = [friendship.requesterId, friendship.addresseeId];
  await prisma.$transaction([
    prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: "BLOCKED", blockedById: user.id, respondedAt: now },
    }),
    prisma.accountabilityPair.updateMany({
      where: { pairKey: friendship.pairKey, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
      data: { status: "ENDED", endedAt: now },
    }),
    /* Block is meant to stop contact, and an open challenge is contact: it keeps tracking both
       users' progress and keeps sending each of them the other's result notifications. Ending the
       accountability pair while leaving the challenge running was half a block. */
    prisma.challenge.updateMany({
      where: {
        status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] },
        OR: [
          { creatorId: userAId, opponentId: userBId },
          { creatorId: userBId, opponentId: userAId },
        ],
      },
      data: { status: "CANCELLED", cancelledAt: now, resolvedAt: now },
    }),
  ]);
  return Response.json({ blocked: true });
}
