import { prisma } from "@/lib/db/prisma";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const cursor = new URL(request.url).searchParams.get("cursor");
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 31,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return Response.json({
    notifications: notifications.slice(0, 30),
    nextCursor: notifications.length > 30 ? notifications[29]?.id : null,
  });
}
