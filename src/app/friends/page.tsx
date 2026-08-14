import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { FriendsWorkspace } from "@/components/social/friends-workspace";
export default async function FriendsPage() {
  const user = await requireUser();
  const [friendships, requests, pairs] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: { id: true, name: true, academicYear: true } },
        addressee: { select: { id: true, name: true, academicYear: true } },
      },
    }),
    prisma.friendship.findMany({
      where: { status: "PENDING", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: { id: true, name: true, academicYear: true } },
        addressee: { select: { id: true, name: true, academicYear: true } },
      },
    }),
    prisma.accountabilityPair.findMany({
      where: { status: { not: "ENDED" }, OR: [{ userAId: user.id }, { userBId: user.id }] },
      include: {
        userA: { select: { id: true, name: true, academicYear: true } },
        userB: { select: { id: true, name: true, academicYear: true } },
      },
    }),
  ]);
  return (
    <FriendsWorkspace
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initialFriendships={friendships}
      initialRequests={requests}
      initialPairs={pairs}
    />
  );
}
