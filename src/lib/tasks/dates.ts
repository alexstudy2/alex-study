import { addDays, addWeeks, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { RecurrenceRule } from "./validation";

export const DEFAULT_TIMEZONE = "Africa/Cairo";
export type TaskDateFilter = "all" | "today" | "week" | "overdue" | "completed";

/**
 * Today's UTC boundaries, pinned to the app's timezone rather than to the caller's clock.
 *
 * Split out of getTaskDateWindow because the client needs the two Dates themselves -- to decide
 * which task cards are late -- and that function's return type is a union across five filters
 * that `in` narrowing will not reduce to "has both bounds": TypeScript normalises the members
 * with optional `gte?: undefined`, so the check passes and the property is still Date|undefined.
 *
 * Same timezone, so a boundary computed here and one computed for a Prisma query agree. A client
 * that used a plain startOfDay(new Date()) instead would disagree with every server-rendered
 * "today" count for anyone whose device clock is in another zone.
 */
export function dayBounds(now = new Date(), timezone = DEFAULT_TIMEZONE) {
  const local = toZonedTime(now, timezone);
  return {
    start: fromZonedTime(startOfDay(local), timezone),
    end: fromZonedTime(endOfDay(local), timezone),
  };
}

export function getTaskDateWindow(
  filter: TaskDateFilter,
  now = new Date(),
  timezone = DEFAULT_TIMEZONE,
) {
  const local = toZonedTime(now, timezone);
  const dayStart = startOfDay(local);
  const weekStart = addDays(dayStart, -dayStart.getDay());
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const utc = (date: Date) => fromZonedTime(date, timezone);
  const day = dayBounds(now, timezone);
  if (filter === "today") return { gte: day.start, lte: day.end };
  if (filter === "week") return { gte: utc(weekStart), lte: utc(weekEnd) };
  if (filter === "overdue") return { lt: day.start };
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
