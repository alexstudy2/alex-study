import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
import { hasCapacity } from "@/lib/lobbies/permissions";
export async function POST(_: Request, c: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await c.params;
  const room = await prisma.room.findFirst({
    where: { id: roomId, archivedAt: null },
    include: { _count: { select: { members: true } } },
  });
  if (!room) return notFound();
  if (!hasCapacity(room._count.members, room.maxMembers))
    return Response.json({ error: "room_full" }, { status: 409 });
  await prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId: user.id } },
    update: { lastSeenAt: new Date() },
    create: { roomId, userId: user.id, lastSeenAt: new Date() },
  });
  return Response.json({ ok: true });
}
