import { endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { cairoDateKey } from "@/lib/calendar/dates";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

/**
 * Day arithmetic for the Plan Forum.
 *
 * A plan is a *list of days*, not a span of hours, so the `YYYY-MM-DD` key is the primary value
 * here and instants are derived from it. Two groups of functions, and the split matters:
 *
 *   - key <-> key (`addDayKey`, `dayKeySpan`, `dayKeyRange`) is pure string arithmetic through UTC.
 *     No timezone is involved because none is needed: the gap between two calendar dates is the
 *     same number wherever you stand. These are safe in client components.
 *   - key -> instant (`cairoDayStart`, `cairoDayRange`, `cairoDayAt9`) pins to Africa/Cairo, and is
 *     what the database columns are written and queried with.
 *
 * Keeping the first group zone-free is what lets the board render its notes without pulling the
 * app's timezone into the browser, and lets the tests check the walk without mocking a clock.
 */

/**
 * The longest plan the board will render. 60 notes is a full exam term and still a page a phone
 * can scroll; without a cap a typo in the end date ("2036") asks the browser for four thousand
 * tilted cards, and the layout is what breaks first -- before any query does.
 */
export const MAX_PLAN_DAYS = 60;

const MS_PER_DAY = 86_400_000;

/** A day key read as a UTC instant, purely so date arithmetic has something to add to. */
function utcOf(dayKey: string) {
  return new Date(`${dayKey}T00:00:00Z`);
}

/** `2026-08-19` + 3 = `2026-08-22`. UTC throughout, so no DST can shorten the step. */
export function addDayKey(dayKey: string, days: number) {
  return new Date(utcOf(dayKey).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Days from one key to another, both ends counted. Same key is 1; reversed is 0 or less. */
export function dayKeySpan(startKey: string, endKey: string) {
  return Math.round((utcOf(endKey).getTime() - utcOf(startKey).getTime()) / MS_PER_DAY) + 1;
}

/**
 * Every key from `startKey` to `endKey` inclusive, or `[]` if they are reversed.
 *
 * Walks in whole days over UTC rather than stepping a *local* time by 24h. Egypt reintroduced DST
 * in 2023, so one night a year is 23 hours long -- a local `+86400000` loop would emit one key
 * twice and skip another, silently losing a day's worth of notes.
 */
export function dayKeyRange(startKey: string, endKey: string) {
  const total = dayKeySpan(startKey, endKey);
  if (total < 1) return [];
  return Array.from({ length: total }, (_, index) => addDayKey(startKey, index));
}

/**
 * A day key as a Cairo-local Date, anchored at noon.
 *
 * Noon rather than midnight because midnight is the one local time a day can lack: Egypt springs
 * forward *at* 00:00, so `2026-04-24T00:00:00` in Cairo never happens. Anchoring at noon and
 * taking `startOfDay` from there lands on that day's real first instant, instead of asking the
 * library to resolve a time that does not exist.
 */
function cairoNoon(dayKey: string, timezone = DEFAULT_TIMEZONE) {
  return toZonedTime(fromZonedTime(`${dayKey}T12:00:00`, timezone), timezone);
}

/** Cairo midnight of a day key, as the UTC instant the `dayDate` column stores. */
export function cairoDayStart(dayKey: string, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(startOfDay(cairoNoon(dayKey, timezone)), timezone);
}

/**
 * The UTC bounds of one Cairo day, for querying rows stored as instants -- the same
 * startOfDay/endOfDay-through-fromZonedTime shape as `dayBounds` in src/lib/tasks/dates.ts.
 */
export function cairoDayRange(dayKey: string, timezone = DEFAULT_TIMEZONE) {
  const local = cairoNoon(dayKey, timezone);
  return {
    start: fromZonedTime(startOfDay(local), timezone),
    end: fromZonedTime(endOfDay(local), timezone),
  };
}

/**
 * 09:00 Cairo on a day key.
 *
 * The hour is not arbitrary: the calendar's own quick-add already dates a new task
 * `${day}T09:00:00+03:00` (calendar-workspace.tsx), so plan notes borrowing the same hour sort in
 * beside real tasks instead of ahead of all of them at midnight.
 */
export function cairoDayAt9(dayKey: string, timezone = DEFAULT_TIMEZONE) {
  return fromZonedTime(`${dayKey}T09:00:00`, timezone);
}

/** How many days a stored period covers, both ends included. `start === end` is one day, not zero. */
export function planDayCount(start: Date, end: Date, timezone = DEFAULT_TIMEZONE) {
  return dayKeySpan(cairoDateKey(start, timezone), cairoDateKey(end, timezone));
}

/** Every day key of a stored period, which is one sticky note each. */
export function planDayKeys(start: Date, end: Date, timezone = DEFAULT_TIMEZONE) {
  return dayKeyRange(cairoDateKey(start, timezone), cairoDateKey(end, timezone));
}

/** Is this key inside the plan's period? Guards items against landing on a day with no note. */
export function isDayInPlan(dayKey: string, start: Date, end: Date, timezone = DEFAULT_TIMEZONE) {
  return dayKey >= cairoDateKey(start, timezone) && dayKey <= cairoDateKey(end, timezone);
}
