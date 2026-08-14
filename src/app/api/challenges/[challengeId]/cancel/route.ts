import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { isChallengeParticipant } from "@/lib/challenges/queries";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (
    !challenge ||
    !isChallengeParticipant(challenge, user.id) ||
    !["PENDING", "SCHEDULED", "ACTIVE"].includes(challenge.status)
  )
    return notFound();
  const now = new Date();
  const updated = await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "CANCELLED", cancelledAt: now, resolvedAt: now },
  });
  const otherId = challenge.creatorId === user.id ? challenge.opponentId : challenge.creatorId;
  await createNotification({
    userId: otherId,
    type: "CHALLENGE_CANCELLED",
    title: `${user.name?.trim() || "Your friend"} cancelled the study challenge`,
    body: "The challenge is closed and no winner was recorded.",
    actionUrl: "/challenges",
    preference: "challengeNotifications",
  });
  return Response.json({ challenge: updated });
}
