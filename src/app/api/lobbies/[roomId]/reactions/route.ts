import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { reactionSchema } from "@/lib/lobbies/validation";
export async function POST(r: Request, c: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await c.params;
  if (
    !(await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } }))
  )
    return unauthorized();
  const p = reactionSchema.safeParse(await r.json().catch(() => null));
  if (!p.success) return invalid();
  const session = await prisma.studySession.findFirst({ where: { id: p.data.sessionId, roomId } });
  if (!session) return invalid();
  try {
    return Response.json(
      {
        reaction: await prisma.sessionReaction.create({
          data: { roomId, sessionId: session.id, senderId: user.id, reaction: p.data.reaction },
        }),
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return Response.json({ error: "reaction_exists" }, { status: 409 });
    throw e;
  }
}
