import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(_request: Request, context: { params: Promise<{ pairId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { pairId } = await context.params;
  const pair = await prisma.accountabilityPair.findFirst({
    where: {
      id: pairId,
      status: "PENDING",
      createdById: { not: user.id },
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
  });
  if (!pair) return notFound();
  const updated = await prisma.accountabilityPair.update({
    where: { id: pair.id },
    data: { status: "ACTIVE", respondedAt: new Date() },
  });
  await createNotification({
    userId: pair.createdById,
    type: "ACCOUNTABILITY_ACCEPTED",
    title: `${user.name} accepted your accountability invite`,
    body: "Supportive reminders will follow both students' notification preferences.",
    actionUrl: "/friends",
    email: true,
  });
  return Response.json({ pair: updated });
}
