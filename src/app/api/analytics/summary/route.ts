import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { analyticsQuerySchema } from "@/lib/analytics/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const params = new URL(request.url).searchParams;
  const parsed = analyticsQuerySchema.safeParse({
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
    subjectId: params.get("subjectId") ?? undefined,
  });
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date();
  const from = parsed.data.from
    ? new Date(parsed.data.from)
    : new Date(to.getTime() - 29 * 86400000);
  return Response.json(await analyticsAggregate(user.id, from, to, parsed.data.subjectId));
}
