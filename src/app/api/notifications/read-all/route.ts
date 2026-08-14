import { prisma } from "@/lib/db/prisma";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function POST() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const result = await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return Response.json({ updated: result.count });
}
