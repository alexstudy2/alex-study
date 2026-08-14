import { addDays, addWeeks, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { RecurrenceRule } from "./validation";

export const DEFAULT_TIMEZONE = "Africa/Cairo";
export type TaskDateFilter = "all" | "today" | "week" | "overdue" | "completed";

export function getTaskDateWindow(
  filter: TaskDateFilter,
  now = new Date(),
  timezone = DEFAULT_TIMEZONE,
) {
  const local = toZonedTime(now, timezone);
  const dayStart = startOfDay(local);
  const dayEnd = endOfDay(local);
  const weekStart = addDays(dayStart, -dayStart.getDay());
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const utc = (date: Date) => fromZonedTime(date, timezone);
  if (filter === "today") return { gte: utc(dayStart), lte: utc(dayEnd) };
  if (filter === "week") return { gte: utc(weekStart), lte: utc(weekEnd) };
  if (filter === "overdue") return { lt: utc(dayStart) };
  return null;
}

export function nextRecurrenceDate(
  currentDueAt: Date,
  rule: RecurrenceRule,
  timezone = DEFAULT_TIMEZONE,
) {
  const local = toZonedTime(currentDueAt, timezone);
  if (rule.frequency === "DAILY") return fromZonedTime(addDays(local, rule.interval), timezone);
  let candidate = addDays(local, 1);
  const maxDays = 7 * rule.interval;
  for (let offset = 1; offset <= maxDays; offset += 1) {
    if (
      rule.weekDays.includes(candidate.getDay()) &&
      (offset <= 7 || Math.floor((offset - 1) / 7) + 1 === rule.interval)
    )
      return fromZonedTime(candidate, timezone);
    candidate = addDays(candidate, 1);
  }
  return fromZonedTime(addWeeks(local, rule.interval), timezone);
}
