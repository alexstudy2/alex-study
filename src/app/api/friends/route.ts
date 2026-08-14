import { prisma } from "@/lib/db/prisma";
import { apiUser, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const friendships = await prisma.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: {
      requester: { select: { id: true, name: true, academicYear: true } },
      addressee: { select: { id: true, name: true, academicYear: true } },
    },
    orderBy: { respondedAt: "desc" },
  });
  return Response.json({ friendships });
}
