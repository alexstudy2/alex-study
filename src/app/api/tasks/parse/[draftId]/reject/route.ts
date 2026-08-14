import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(_: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { draftId } = await ctx.params;
  const result = await prisma.taskDraft.updateMany({
    where: { id: draftId, userId: user.id, status: "PENDING" },
    data: { status: "REJECTED", decidedAt: new Date() },
  });
  return result.count ? Response.json({ ok: true }) : notFound();
}
