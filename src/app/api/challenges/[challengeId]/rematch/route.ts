import { prisma } from "@/lib/db/prisma";
import { createChallenge } from "@/lib/challenges/service";
import { isChallengeParticipant } from "@/lib/challenges/queries";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const original = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { subject: { select: { normalizedName: true, name: true } } },
  });
  if (
    !original ||
    !isChallengeParticipant(original, user.id) ||
    !["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(original.status)
  )
    return notFound();
  const opponentId = original.creatorId === user.id ? original.opponentId : original.creatorId;
  const duration = original.endsAt.getTime() - original.startsAt.getTime();
  const startsAt = new Date();
  const subjectKey = original.subjectKey ?? original.subject?.normalizedName ?? null;
  const subjectLabel = original.subjectLabel ?? original.subject?.name ?? subjectKey;
  const ownedSubject = subjectKey
    ? await prisma.subject.findFirst({
        where: { userId: user.id, normalizedName: subjectKey, archivedAt: null },
        select: { id: true },
      })
    : null;
  const result = await createChallenge(
    user,
    {
      opponentId,
      type: original.type,
      resolutionType: original.resolutionType,
      targetValue: original.targetValue,
      subjectId: ownedSubject?.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + duration).toISOString(),
    },
    {
      rematchOfId: original.id,
      subjectSnapshot:
        subjectKey && subjectLabel ? { key: subjectKey, label: subjectLabel } : undefined,
    },
  );
  if ("error" in result) return invalid({ challenge: [result.error] });
  return Response.json(result, { status: 201 });
}
