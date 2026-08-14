import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { challengeInclude } from "@/lib/challenges/queries";
import { challengeStats } from "@/lib/challenges/service";
import { ChallengeList } from "@/components/challenges/challenge-list";

export default async function ChallengesPage() {
  const user = await requireUser();
  const [challenges, stats] = await Promise.all([
    prisma.challenge.findMany({
      where: { OR: [{ creatorId: user.id }, { opponentId: user.id }] },
      include: challengeInclude,
      orderBy: { createdAt: "desc" },
    }),
    challengeStats(user.id),
  ]);
  return (
    <ChallengeList
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initialChallenges={challenges}
      stats={stats}
    />
  );
}
