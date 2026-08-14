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
  await prisma.friendship.delete({ where: { id: friendship.id } });
  return new Response(null, { status: 204 });
}
