import { prisma } from "@/lib/db/prisma";
import { reconcileChallenge } from "@/lib/challenges/engine";
import { challengeInclude, isChallengeParticipant } from "@/lib/challenges/queries";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const owned = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!owned || !isChallengeParticipant(owned, user.id)) return notFound();
  if (owned.acceptedAt) await reconcileChallenge(owned.id);
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: challengeInclude,
  });
  return Response.json({ challenge, serverNow: new Date().toISOString() });
}
