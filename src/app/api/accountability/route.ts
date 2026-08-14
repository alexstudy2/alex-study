import { prisma } from "@/lib/db/prisma";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const pairs = await prisma.accountabilityPair.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }], status: { not: "ENDED" } },
    include: {
      userA: { select: { id: true, name: true, academicYear: true } },
      userB: { select: { id: true, name: true, academicYear: true } },
      _count: { select: { checks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return Response.json({ pairs });
}
