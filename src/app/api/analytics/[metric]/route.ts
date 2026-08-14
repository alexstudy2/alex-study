import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
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
  const { metric } = await context.params;
  if (!allowed.includes(metric)) return invalid();
  const params = new URL(request.url).searchParams;
  const to = params.get("to") ? new Date(params.get("to")!) : new Date();
  const from = params.get("from")
    ? new Date(params.get("from")!)
    : new Date(to.getTime() - 29 * 86400000);
  const data = await analyticsAggregate(user.id, from, to, params.get("subjectId") ?? undefined);
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
