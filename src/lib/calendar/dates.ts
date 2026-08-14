import { addDays, endOfDay, endOfMonth, startOfDay, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

export type CalendarView = "month" | "week" | "agenda";

export function calendarWindow(anchor: Date, view: CalendarView, timezone = DEFAULT_TIMEZONE) {
  const local = toZonedTime(anchor, timezone);
  let start = startOfDay(local);
  let end = endOfDay(addDays(start, 30));
  if (view === "month") {
    start = addDays(startOfMonth(local), -startOfMonth(local).getDay());
    const monthEnd = endOfMonth(local);
    end = endOfDay(addDays(monthEnd, 6 - monthEnd.getDay()));
  } else if (view === "week") {
    start = addDays(start, -start.getDay());
    end = endOfDay(addDays(start, 6));
  }
  return { start: fromZonedTime(start, timezone), end: fromZonedTime(end, timezone) };
}

export function cairoDateKey(date: Date, timezone = DEFAULT_TIMEZONE) {
  const local = toZonedTime(date, timezone);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}
