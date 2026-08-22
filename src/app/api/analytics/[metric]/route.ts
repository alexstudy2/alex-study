import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { resolveAnalyticsWindow } from "@/lib/analytics/window";
import { analyticsQuerySchema } from "@/lib/analytics/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, readRateLimit } from "@/lib/http/rate-limit";
const allowed = [
  "study-hours",
  "subjects",
  "task-completion",
  "planned-vs-actual",
  "productive-times",
  "activity",
  "focus-score",
];
export async function GET(request: Request, context: { params: Promise<{ metric: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, readRateLimit, user.id);
  if (limited) return limited;
  const { metric } = await context.params;
  if (!allowed.includes(metric)) return invalid();
  /* Same zod contract as /api/analytics/summary (audit L4): this route used to read raw
     params, so `days=1000000000` produced a giant window and subjectId was never
     uuid-checked. */
  const parsed = analyticsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const query = parsed.data;
  const window = resolveAnalyticsWindow(query.days ?? undefined);
  const to = query.to ? new Date(query.to) : window.to;
  const from = query.from ? new Date(query.from) : window.from;
  const data = await analyticsAggregate(user.id, from, to, query.subjectId);
  const result =
    metric === "subjects"
      ? data.bySubject
      : metric === "productive-times"
        ? data.byHour
        : metric === "activity"
          ? data.daily
          : metric === "study-hours"
            ? data.daily.map((item) => ({ date: item.date, minutes: item.minutes }))
            : metric === "task-completion"
              ? {
                  completed: data.summary.tasksCompleted,
                  due: data.summary.tasksDue,
                  rate: data.summary.completionRate,
                }
              : metric === "planned-vs-actual"
                ? data.daily.map((item) => ({
                    date: item.date,
                    plannedMinutes: item.plannedMinutes,
                    actualMinutes: item.minutes,
                  }))
                : { averageFocusScore: data.summary.averageFocusScore, daily: data.daily };
  return Response.json({ metric, data: result, summary: data.summary });
}
