import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { ChallengeCreateForm } from "@/components/challenges/challenge-create-form";

export default async function NewChallengePage() {
  const user = await requireUser();
  const [friendships, subjects] = await Promise.all([
    prisma.friendship.findMany({
      where: { status: "ACCEPTED", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
      include: {
        requester: { select: { id: true, name: true, academicYear: true } },
        addressee: { select: { id: true, name: true, academicYear: true } },
      },
      orderBy: { respondedAt: "desc" },
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, normalizedName: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const friends = friendships.map((friendship) =>
    friendship.requesterId === user.id ? friendship.addressee : friendship.requester,
  );
  return (
    <ChallengeCreateForm
      locale={user.locale.toLowerCase() as "en" | "ar"}
      friends={friends}
      subjects={subjects}
    />
  );
}
