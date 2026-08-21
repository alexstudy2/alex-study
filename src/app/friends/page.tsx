import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { friendshipInclude, accountabilityPairInclude } from "@/lib/social/queries";
import { FriendsWorkspace } from "@/components/social/friends-workspace";
export default async function FriendsPage() {
  const user = await requireUser();
  const [friendships, requests, pairs, openChallenges] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: friendshipInclude,
      // Newest friendship first. Without an order these three lists came back in whatever order
      // Postgres felt like, so the page reshuffled itself between visits.
      orderBy: { respondedAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { status: "PENDING", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: friendshipInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.accountabilityPair.findMany({
      /* `not: "ENDED"` also let DECLINED pairs through, and the client has no card for one: it fell
         into the "no actions apply" branch and rendered a row with a raw status and nothing to do. */
      where: {
        status: { in: ["PENDING", "ACTIVE", "PAUSED"] },
        OR: [{ userAId: user.id }, { userBId: user.id }],
      },
      include: accountabilityPairInclude,
      orderBy: { updatedAt: "desc" },
    }),
    /* Lets a friend card offer the right control: a challenge you already share opens it, and
       everyone else gets the composer with them preselected. `createChallenge` refuses a second
       open challenge per pair, so without this the button was an invitation to a rejection. */
    prisma.challenge.findMany({
      where: {
        status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] },
        OR: [{ creatorId: user.id }, { opponentId: user.id }],
      },
      select: { id: true, creatorId: true, opponentId: true },
    }),
  ]);
  const openChallengeByFriend: Record<string, string> = {};
  for (const challenge of openChallenges) {
    const otherId = challenge.creatorId === user.id ? challenge.opponentId : challenge.creatorId;
    openChallengeByFriend[otherId] ??= challenge.id;
  }
  return (
    <FriendsWorkspace
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initialFriendships={friendships}
      initialRequests={requests}
      initialPairs={pairs}
      openChallengeByFriend={openChallengeByFriend}
    />
  );
}
