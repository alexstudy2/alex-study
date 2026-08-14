import { buildLeaderboard } from "@/lib/leaderboards/service";
import { leaderboardQuerySchema } from "@/lib/challenges/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const parsed = leaderboardQuerySchema.safeParse({
    metric: url.searchParams.get("metric") ?? undefined,
    academicYear: url.searchParams.get("academicYear") || undefined,
  });
  if (!parsed.success) return invalid();
  return Response.json(await buildLeaderboard({ scope: "ALL_COLLEGE", ...parsed.data }));
}
