import { prisma } from "@/lib/db/prisma";
import { isChallengeParticipant } from "@/lib/challenges/queries";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !isChallengeParticipant(challenge, user.id)) return notFound();
  const events = await prisma.challengeProgressEvent.findMany({
    where: { challengeId },
    include: { progress: { include: { user: { select: { id: true, name: true } } } } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return Response.json({ events });
}
