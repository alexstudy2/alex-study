import { prisma } from "@/lib/db/prisma";
import { friendshipInclude } from "@/lib/social/queries";
import { apiUser, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: friendshipInclude,
    orderBy: { respondedAt: "desc" },
  });
  return Response.json({ friendships });
}
