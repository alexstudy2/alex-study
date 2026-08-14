import { buildLeaderboard } from "@/lib/leaderboards/service";
import { leaderboardQuerySchema } from "@/lib/challenges/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = leaderboardQuerySchema.safeParse({
    metric: new URL(request.url).searchParams.get("metric") ?? undefined,
  });
  if (!parsed.success) return invalid();
  return Response.json(
    await buildLeaderboard({ scope: "FRIENDS", ownerUserId: user.id, metric: parsed.data.metric }),
  );
}
