import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { analyticsQuerySchema } from "@/lib/analytics/validation";
import { resolveAnalyticsWindow } from "@/lib/analytics/window";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const params = new URL(request.url).searchParams;
  const parsed = analyticsQuerySchema.safeParse({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    days: params.get("days") ?? undefined,
    subjectId: params.get("subjectId") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  /* Explicit instants win; otherwise the window is whole Cairo days, which is what the day
     buckets inside analyticsAggregate are built from. The `to.getTime() - 29 * 86400000` this
     replaces produced a `from` in the middle of a day, so the first column of every chart was a
     partial day presented as a whole one. */
  const window = resolveAnalyticsWindow(parsed.data.days);
  const to = parsed.data.to ? new Date(parsed.data.to) : window.to;
  const from = parsed.data.from ? new Date(parsed.data.from) : window.from;
  return Response.json(await analyticsAggregate(user.id, from, to, parsed.data.subjectId));
}
