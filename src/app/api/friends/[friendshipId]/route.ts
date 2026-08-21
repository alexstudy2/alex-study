import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function DELETE(
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
  /* Accountability pairs outlive the friendship row they were created from -- their own `pairKey`
     is what the reminder job reads, not the friendship. Removing a friend used to leave an ACTIVE
     pair behind, so someone you had just dropped kept receiving your missed-session nudges. Block
     already ended them; remove now does the same. */
  await prisma.$transaction([
    prisma.accountabilityPair.updateMany({
      where: { pairKey: friendship.pairKey, status: { in: ["PENDING", "ACTIVE", "PAUSED"] } },
      data: { status: "ENDED", endedAt: new Date() },
    }),
    prisma.friendship.delete({ where: { id: friendship.id } }),
  ]);
  return new Response(null, { status: 204 });
}
