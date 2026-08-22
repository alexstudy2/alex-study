import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
import { hasCapacity } from "@/lib/lobbies/permissions";
import { joinRoomSchema } from "@/lib/lobbies/validation";

/**
 * Join a room.
 *
 * Two gates beyond "does it exist" (audit M8):
 *   - PRIVATE rooms require the owner's invite code. A wrong or missing code returns the
 *     same 404 as an unknown room, so private membership is not even confirmable.
 *   - Capacity is re-counted inside the serializable transaction that inserts membership,
 *     so N concurrent joins at 24/25 cannot all see room for one more.
 * The `[roomId, userId]` unique still guards exact duplicates, and rejoining is treated
 * as a heartbeat rather than consuming capacity math again.
 */
export async function POST(request: Request, c: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await c.params;
  const parsed = joinRoomSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return notFound();

  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
    select: { id: true },
  });
  if (existing) {
    /* Rejoining is a heartbeat, not a second seat: refresh presence without touching the
       capacity math at all. */
    await prisma.roomMember.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return Response.json({ ok: true });
  }
  const room = await prisma.room.findFirst({
    where: { id: roomId, archivedAt: null },
    select: { maxMembers: true, visibility: true, inviteCodeHash: true },
  });
  if (!room) return notFound();
  if (
    room.visibility === "PRIVATE" &&
    (!parsed.data.code ||
      !room.inviteCodeHash ||
      createHash("sha256").update(parsed.data.code).digest("hex") !== room.inviteCodeHash)
  )
    /* Same response as "no such room": private status stays unconfirmable. */
    return notFound();
  try {
    /* The callback's return value is the transaction's resolved value -- use it to carry
       the capacity verdict out instead of returning a Response from inside (which would
       be silently dropped while the outer handler reports ok). */
    const denied = await prisma.$transaction(
      async (tx) => {
        const members = await tx.roomMember.count({ where: { roomId } });
        if (!hasCapacity(members, room.maxMembers)) return true;
        await tx.roomMember.create({ data: { roomId, userId: user.id, lastSeenAt: new Date() } });
        return false;
      },
      { isolationLevel: "Serializable", timeout: 15000, maxWait: 10000 },
    );
    if (denied) return Response.json({ error: "room_full" }, { status: 409 });
  } catch (error) {
    /* Serialization failures are the database saying "you raced, retry or lose" --
       surfacing them as a conflict keeps semantics honest without masking real errors. */
    const code = (error as { code?: string }).code;
    if (code === "P2034" || code === "P2002")
      return Response.json({ error: "room_full" }, { status: 409 });
    throw error;
  }
  return Response.json({ ok: true });
}
