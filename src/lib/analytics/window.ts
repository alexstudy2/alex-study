import { addDays, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

/** Range lengths the toolbar offers. The client sends the number; the server resolves the days. */
export const ANALYTICS_RANGES = [7, 30, 90] as const;
export const DEFAULT_ANALYTICS_DAYS = 30;

/**
 * The `days`-long window ending with today, as two real UTC instants.
 *
 * This exists because the same window was being computed in four places with raw millisecond
 * arithmetic -- `new Date(to.getTime() - 29 * 86400000)` in the page, in both API routes, and in
 * the client's range picker -- and none of those agreed with the day buckets `analyticsAggregate`
 * builds, which are pinned to Africa/Cairo. A student in Cairo at 01:00 asking for "7 days" got a
 * window starting mid-day-1 from a browser in another zone, so the first and last columns of every
 * chart were partial and the totals were quietly wrong.
 *
 * Whole local days, inclusive at both ends: `days = 7` means the last seven calendar days
 * *including* today, which is what "last 7 days" means to a reader of the chart. `fromZonedTime`
 * converts the local wall-clock boundary back to the instant Prisma has to compare against --
 * `toZonedTime` alone would hand back a Date whose UTC fields hold local values, which is the
 * right shape for date-string bucketing (that is what aggregate.ts does with it) and the wrong
 * shape for a query.
 *
 * Pure -- date-fns and date-fns-tz only, no Prisma, no server imports -- so the client component
 * can call it to build the same window the server will.
 */
export function resolveAnalyticsWindow(
  days = DEFAULT_ANALYTICS_DAYS,
  now = new Date(),
  timezone = DEFAULT_TIMEZONE,
) {
  const local = toZonedTime(now, timezone);
  const span = Math.max(1, Math.trunc(days));
  return {
    from: fromZonedTime(startOfDay(addDays(local, -(span - 1))), timezone),
    to: fromZonedTime(endOfDay(local), timezone),
    days: span,
  };
}

/**
 * The equally long window immediately before `from`, for period-over-period comparison.
 *
 * Derived from the same `days` count rather than from `to - from`: the requested window ends at
 * 23:59:59.999 today, so subtracting the raw span would land the previous window a millisecond
 * short and drop one session in the worst case. Ends one millisecond before `from`, so the two
 * windows are adjacent and share no row -- a session exactly on the boundary must be counted once.
 */
export function previousAnalyticsWindow(from: Date, days: number, timezone = DEFAULT_TIMEZONE) {
  const span = Math.max(1, Math.trunc(days));
  const localFrom = toZonedTime(from, timezone);
  return {
    from: fromZonedTime(startOfDay(addDays(localFrom, -span)), timezone),
    to: new Date(from.getTime() - 1),
  };
}
