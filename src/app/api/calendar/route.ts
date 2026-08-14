import { calendarEvents } from "@/lib/calendar/queries";
import type { CalendarView } from "@/lib/calendar/dates";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "month";
  const anchor = params.get("anchor") ? new Date(params.get("anchor")!) : new Date();
  if (!["month", "week", "agenda"].includes(view) || Number.isNaN(anchor.getTime()))
    return invalid();
  return Response.json({ events: await calendarEvents(user.id, anchor, view as CalendarView) });
}
