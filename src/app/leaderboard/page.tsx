import { LeaderboardWorkspace } from "@/components/leaderboards/leaderboard-workspace";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { buildLeaderboard } from "@/lib/leaderboards/service";

export default async function LeaderboardPage() {
  const user = await requireUser();
  const [initial, current] = await Promise.all([
    buildLeaderboard({ scope: "ALL_COLLEGE", metric: "STUDY_MINUTES" }),
    prisma.user.findUnique({ where: { id: user.id }, select: { leaderboardVisible: true } }),
  ]);
  return (
    <LeaderboardWorkspace
      userId={user.id}
      locale={user.locale.toLowerCase() as "en" | "ar"}
      initial={initial}
      initialVisible={current?.leaderboardVisible ?? true}
    />
  );
}
