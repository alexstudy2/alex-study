import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { lobbyTaskSchema } from "@/lib/lobbies/validation";

export async function PATCH(request: Request, context: { params: Promise<{ roomId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId } = await context.params;
  const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: user.id } } });
  if (!member) return unauthorized();
  const parsed = lobbyTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const title = parsed.data.title?.trim() || null;
  const task = await prisma.roomMember.update({
    where: { id: member.id },
    data: {
      lobbyTaskTitle: title,
      lobbyTaskCompleted: title ? parsed.data.completed ?? false : false,
      lobbyTaskUpdatedAt: new Date(),
    },
    select: { lobbyTaskTitle: true, lobbyTaskCompleted: true, lobbyTaskUpdatedAt: true },
  });
  return Response.json({ task });
}
