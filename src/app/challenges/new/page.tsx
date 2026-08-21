import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { socialPersonSelect } from "@/lib/social/queries";
import { ChallengeCreateForm } from "@/components/challenges/challenge-create-form";

export default async function NewChallengePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const [friendships, subjects, openChallenges, params] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: socialPersonSelect },
        addressee: { select: socialPersonSelect },
      },
      orderBy: { respondedAt: "desc" },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, normalizedName: true },
      orderBy: { name: "asc" },
    }),
    /* `createChallenge` allows one open challenge per pair. Loading them here lets the picker say so
       up front instead of accepting the choice and answering with `active_pair_challenge`. */
    prisma.challenge.findMany({
      where: {
        status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] },
        OR: [{ creatorId: user.id }, { opponentId: user.id }],
      },
      select: { id: true, creatorId: true, opponentId: true },
    }),
    searchParams,
  ]);
  const friends = friendships.map((friendship) =>
    friendship.requesterId === user.id ? friendship.addressee : friendship.requester,
  );
  const openChallengeByFriend: Record<string, string> = {};
  for (const challenge of openChallenges) {
    const otherId = challenge.creatorId === user.id ? challenge.opponentId : challenge.creatorId;
    openChallengeByFriend[otherId] ??= challenge.id;
  }
  // The friend cards on /friends link here with the opponent already chosen.
  const opponent = params.opponent;
  return (
    <ChallengeCreateForm
      locale={user.locale.toLowerCase() as "en" | "ar"}
      friends={friends}
      subjects={subjects}
      preselectedOpponentId={typeof opponent === "string" ? opponent : ""}
      openChallengeByFriend={openChallengeByFriend}
    />
  );
}
