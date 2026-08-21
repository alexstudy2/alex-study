import { prisma } from "@/lib/db/prisma";
import { accountabilityPairInclude } from "@/lib/social/queries";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const pairs = await prisma.accountabilityPair.findMany({
    // Same three live states the page queries -- `not: "ENDED"` also returned DECLINED pairs, which
    // no client has a card for.
    where: {
      OR: [{ userAId: user.id }, { userBId: user.id }],
      status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
    },
    include: { ...accountabilityPairInclude, _count: { select: { checks: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ pairs });
}
