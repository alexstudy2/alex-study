import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, opponentId: user.id, status: "PENDING" },
  });
  if (!challenge) return notFound();
  const updated = await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "DECLINED", resolvedAt: new Date() },
  });
  await createNotification({
    userId: challenge.creatorId,
    type: "CHALLENGE_DECLINED",
    title: `${user.name?.trim() || "Your friend"} declined the study challenge`,
    body: "No activity was counted.",
    actionUrl: "/challenges",
    preference: "challengeNotifications",
  });
  return Response.json({ challenge: updated });
}
