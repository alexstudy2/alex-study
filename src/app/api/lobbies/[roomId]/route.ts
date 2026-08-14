import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function GET(_: Request, c: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await c.params;
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!membership) return unauthorized();
  await prisma.roomMember.update({
    where: { id: membership.id },
    data: { lastSeenAt: new Date() },
  });
  const room = await prisma.room.findFirst({
    where: { id: roomId, archivedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, academicYear: true } } },
        orderBy: { joinedAt: "asc" },
      },
      timerRuns: {
        where: { status: { in: ["RUNNING", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      messages: {
        where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        include: { user: { select: { id: true, name: true, academicYear: true } } },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
    },
  });
  return room
    ? Response.json({ room, membership, serverNow: new Date().toISOString() })
    : notFound();
}
