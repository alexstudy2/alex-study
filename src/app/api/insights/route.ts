import { prisma } from "@/lib/db/prisma";
import { insightSelect } from "@/lib/insights/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, readRateLimit } from "@/lib/http/rate-limit";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, readRateLimit, user.id);
  if (limited) return limited;
  return Response.json({
    insights: await prisma.aIInsight.findMany({
      where: { userId: user.id, dismissedAt: null, purgeAt: { gt: new Date() } },
      select: insightSelect,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  });
}
