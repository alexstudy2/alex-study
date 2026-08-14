import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(_: Request, context: { params: Promise<{ insightId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { insightId } = await context.params;
  const result = await prisma.aIInsight.updateMany({
    where: { id: insightId, userId: user.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });
  return result.count ? Response.json({ ok: true }) : notFound();
}
