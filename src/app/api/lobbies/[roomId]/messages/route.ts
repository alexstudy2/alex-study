import { prisma } from "@/lib/db/prisma";
import { apiUser, forbidden, invalid, unauthorized } from "@/lib/tasks/response";
import { messageSchema } from "@/lib/lobbies/validation";
import { chatRateLimit, enforceRateLimit } from "@/lib/http/rate-limit";

type Context = { params: Promise<{ roomId: string }> };

export async function GET(_: Request, context: Context) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await context.params;
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!member) return forbidden();

  const messages = await prisma.roomMessage.findMany({
    where: {
      roomId,
      deletedAt: null,
      createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
    },
    include: { user: { select: { id: true, name: true, academicYear: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return Response.json({ messages });
}

export async function POST(request: Request, context: Context) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, chatRateLimit, user.id);
  if (limited) return limited;
  const { roomId } = await context.params;
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    include: { room: true },
  });
  if (!member || !member.room.chatEnabled) return forbidden();

  const message = await prisma.roomMessage.create({
    data: { roomId, userId: user.id, body: parsed.data.body },
    include: { user: { select: { id: true, name: true, academicYear: true } } },
  });
  return Response.json({ message }, { status: 201 });
}
