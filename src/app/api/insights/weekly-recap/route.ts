import { prisma } from "@/lib/db/prisma";
import { insightSelect } from "@/lib/insights/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const insight = await prisma.aIInsight.findFirst({
    where: {
      userId: user.id,
      type: "WEEKLY_RECAP",
      dismissedAt: null,
      purgeAt: { gt: new Date() },
    },
    select: insightSelect,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ insight });
}
