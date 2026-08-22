import { buildLeaderboard } from "@/lib/leaderboards/service";
import { leaderboardQuerySchema } from "@/lib/challenges/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, readRateLimit } from "@/lib/http/rate-limit";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, readRateLimit, user.id);
  if (limited) return limited;
  const parsed = leaderboardQuerySchema.safeParse({
    metric: new URL(request.url).searchParams.get("metric") ?? undefined,
  });
  if (!parsed.success) return invalid();
  return Response.json(
    await buildLeaderboard({ scope: "FRIENDS", ownerUserId: user.id, metric: parsed.data.metric }),
  );
}
