import { calendarEvents } from "@/lib/calendar/queries";
import { calendarWindow, type CalendarView } from "@/lib/calendar/dates";
import { planCalendarEvents, visiblePlan } from "@/lib/plan-forum/queries";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, readRateLimit } from "@/lib/http/rate-limit";

/**
 * The grid's events for one window.
 *
 * `source=plan` swaps *what* is painted, not how: the same `calendarWindow` bounds are handed to
 * `planCalendarEvents` instead of `calendarEvents`, so a plan overlay and the real schedule are the
 * same shape and the client needs no second code path. Nothing is written either way -- pointing
 * the calendar at a plan is a view, and copying a day into real tasks is a separate, explicit call.
 */
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, readRateLimit, user.id);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "month";
  const anchor = params.get("anchor") ? new Date(params.get("anchor")!) : new Date();
  if (!["month", "week", "agenda"].includes(view) || Number.isNaN(anchor.getTime()))
    return invalid();

  if (params.get("source") === "plan") {
    const planId = params.get("planId");
    if (!planId) return invalid({ planId: ["A plan id is required for source=plan"] });
    // Re-checked per request rather than trusted from the URL: a link can be pasted to anyone.
    const plan = await visiblePlan(user, planId);
    if (!plan) return notFound();
    const { start, end } = calendarWindow(anchor, view as CalendarView);
    return Response.json({ events: await planCalendarEvents(planId, start, end) });
  }

  return Response.json({ events: await calendarEvents(user.id, anchor, view as CalendarView) });
}
