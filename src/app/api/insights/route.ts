import { prisma } from "@/lib/db/prisma";
import { insightSelect } from "@/lib/insights/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  return Response.json({
    insights: await prisma.aIInsight.findMany({
      where: { userId: user.id, dismissedAt: null, purgeAt: { gt: new Date() } },
      select: insightSelect,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  });
}
