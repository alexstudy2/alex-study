import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";
export async function POST(_: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { taskId } = await ctx.params;
  const result = await prisma.task.updateMany({
    where: { id: taskId, userId: user.id, deletedAt: null },
    data: { status: "TODO", completedAt: null },
  });
  if (result.count) await recalculateChallengesForUser(user.id);
  return result.count ? Response.json({ ok: true }) : notFound();
}
