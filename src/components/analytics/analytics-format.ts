/**
 * Formatting and small derivations shared by the /analytics panels.
 *
 * Pure and framework-free -- no React, no `"use client"` -- so the server page and every client
 * panel can use the same functions and cannot disagree about, say, which day a week starts on.
 */

export function formatMinutes(minutes: number, ar: boolean) {
  if (minutes < 60) return ar ? `${minutes} د` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? (ar ? `${hours}س ${rest}د` : `${hours}h ${rest}m`) : ar ? `${hours}س` : `${hours}h`;
}

export function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Short weekday names indexed 0 = Sunday, matching `Date.prototype.getDay` and the weekday index
 * the aggregate emits.
 *
 * 2024-01-07 is the anchor because it was a Sunday, and it is read back in UTC -- a local-time
 * read would shift the whole array by one for anyone west of Greenwich, silently relabelling
 * every row of the heatmap.
 */
export function weekdayLabels(locale: "en" | "ar") {
  const format = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2024, 0, 7 + index))));
}

/** The seven weekday indices in the reader's own order, e.g. `[1..6, 0]` for a Monday-first week. */
export function weekdayOrder(weekStartsOn: number) {
  const start = ((Math.trunc(weekStartsOn) % 7) + 7) % 7;
  return Array.from({ length: 7 }, (_, index) => (start + index) % 7);
}

/** `2026-08-19` -> a UTC instant. The date strings the aggregate emits are local calendar dates
 *  with no zone, so they must be read in a fixed zone or they drift by a day near midnight. */
export function parseDayKey(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

export function formatDayLabel(date: string, locale: "en" | "ar") {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDayKey(date));
}

/**
 * A course's colour as a `var()` string, for the SVG `fill` of a donut slice or a legend swatch.
 *
 * The list is closed on purpose. `colorToken` is stored as a bare `String` in the schema, so a row
 * written before the zod enum existed -- or by hand -- can hold anything, and `var(--subject-)`
 * would resolve to nothing and paint the slice black. Anything unrecognised falls back to the
 * primary ink instead.
 *
 * Note this returns a custom property rather than resolving it: the seven `--subject-*` tokens are
 * redefined per mood, so handing recharts the variable means the donut re-tints itself on a mood
 * change with nothing listening for it.
 */
const SUBJECT_TOKENS = ["teal", "coral", "amber", "violet", "sky", "rose", "slate"];

export function subjectVar(colorToken: string | null | undefined) {
  const token = (colorToken ?? "").toLowerCase();
  return SUBJECT_TOKENS.includes(token) ? `var(--subject-${token})` : "var(--primary)";
}

export type Direction = "up" | "down" | "flat";

/**
 * Change against the previous equal-length period.
 *
 * Two modes, because a percentage change *of a percentage* is a number nobody can interpret: a
 * completion rate going 40% -> 50% is "+25%" in relative terms and "+10 points" in the terms the
 * reader is actually thinking in. Rates and scores use `points`; totals use `percent`.
 *
 * `value: null` with a non-flat direction means "no baseline" -- previous was zero, so there is no
 * ratio to state, only the fact that this period has something and the last one did not.
 */
export function changeFrom(
  current: number | null,
  previous: number | null,
  mode: "percent" | "points" = "percent",
): { direction: Direction; value: number | null } {
  if (current == null || previous == null) return { direction: "flat", value: null };
  if (mode === "points") {
    const diff = Math.round((current - previous) * 10) / 10;
    return { direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat", value: Math.abs(diff) };
  }
  if (previous === 0) return { direction: current > 0 ? "up" : "flat", value: null };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat", value: Math.abs(pct) };
}

/**
 * Five intensity steps for a heatmap cell: 0 for "nothing recorded", then quartiles of the range's
 * own busiest day.
 *
 * Relative to the maximum rather than to fixed minute thresholds, because the point of the map is
 * the *shape* of somebody's month; a fixed scale would render a light week as uniformly blank and
 * a heavy one as uniformly solid, which is the one thing a heatmap must not do.
 */
export function intensity(minutes: number, max: number) {
  if (minutes <= 0 || max <= 0) return 0;
  return Math.min(4, Math.ceil((minutes / max) * 4));
}
