import { prisma } from "@/lib/db/prisma";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { notificationId } = await context.params;
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (!result.count) return notFound();
  return Response.json({ read: true });
}
