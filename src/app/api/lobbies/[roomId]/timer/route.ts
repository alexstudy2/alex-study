import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { roomTimerSchema } from "@/lib/lobbies/validation";
import { canControlTimer } from "@/lib/lobbies/permissions";
export async function POST(r: Request, c: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await c.params;
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!member || !canControlTimer(member.role)) return unauthorized();
  const p = roomTimerSchema.safeParse(await r.json().catch(() => null));
  if (!p.success) return invalid();
  const now = new Date();
  try {
    const timer = await prisma.timerRun.create({
      data: {
        userId: user.id,
        hostUserId: user.id,
        roomId,
        mode: p.data.mode,
        durationSeconds: p.data.durationSeconds,
        startedAt: now,
        segmentStartedAt: now,
      },
    });
    return Response.json({ timer, serverNow: now.toISOString() }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return Response.json({ error: "active_room_timer_exists" }, { status: 409 });
    throw e;
  }
}
