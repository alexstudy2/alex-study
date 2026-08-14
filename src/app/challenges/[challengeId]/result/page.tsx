import { notFound, redirect } from "next/navigation";
import { ChallengeResult } from "@/components/challenges/challenge-result";
import { requireUser } from "@/lib/auth/session";
import { reconcileChallenge } from "@/lib/challenges/engine";
import { challengeInclude, isChallengeParticipant } from "@/lib/challenges/queries";
import { publicName } from "@/lib/challenges/rules";
import { prisma } from "@/lib/db/prisma";

export default async function ChallengeResultPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const user = await requireUser();
  const { challengeId } = await params;
  const owned = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!owned || !isChallengeParticipant(owned, user.id)) notFound();
  if (!["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(owned.status))
    redirect(`/challenges/${owned.id}`);
  if (owned.acceptedAt) await reconcileChallenge(owned.id);
  const [challenge, preference, cardUsers] = await Promise.all([
    prisma.challenge.findUnique({ where: { id: challengeId }, include: challengeInclude }),
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
    prisma.user.findMany({
      where: { id: { in: [owned.creatorId, owned.opponentId] } },
      select: {
        id: true,
        name: true,
        preference: { select: { shareFullNameOnCards: true } },
      },
    }),
  ]);
  if (!challenge) notFound();
  if (!["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(challenge.status))
    redirect(`/challenges/${challenge.id}`);
  return (
    <ChallengeResult
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initialChallenge={challenge}
      initialShareFullName={preference?.shareFullNameOnCards ?? false}
      initialPublicNames={Object.fromEntries(
        cardUsers.map((cardUser) => [
          cardUser.id,
          publicName(cardUser.name, cardUser.preference?.shareFullNameOnCards ?? false),
        ]),
      )}
    />
  );
}
