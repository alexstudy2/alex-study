import { notFound } from "next/navigation";
import { ChallengeDetail } from "@/components/challenges/challenge-detail";
import { requireUser } from "@/lib/auth/session";
import { reconcileChallenge } from "@/lib/challenges/engine";
import { challengeInclude, isChallengeParticipant } from "@/lib/challenges/queries";
import { prisma } from "@/lib/db/prisma";

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const user = await requireUser();
  const { challengeId } = await params;
  const owned = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!owned || !isChallengeParticipant(owned, user.id)) notFound();
  if (owned.acceptedAt) await reconcileChallenge(owned.id);
  const [challenge, events] = await Promise.all([
    prisma.challenge.findUnique({ where: { id: challengeId }, include: challengeInclude }),
    prisma.challengeProgressEvent.findMany({
      where: { challengeId },
      include: { progress: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);
  if (!challenge) notFound();
  return (
    <ChallengeDetail
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initialChallenge={challenge}
      initialEvents={events}
      serverNow={new Date().toISOString()}
    />
  );
}
