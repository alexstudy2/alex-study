import { prisma } from "@/lib/db/prisma";
import { reconcileChallenge } from "@/lib/challenges/engine";
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
  if (challenge.acceptedAt) await reconcileChallenge(challenge.id);
  const current = await prisma.challenge.findUnique({
    where: { id: challenge.id },
    select: {
      status: true,
      winnerId: true,
      resolvedAt: true,
      startsAt: true,
      endsAt: true,
      progress: {
        include: { user: { select: { id: true, name: true, academicYear: true } } },
      },
    },
  });
  return Response.json({ ...current, serverNow: new Date().toISOString() });
}
