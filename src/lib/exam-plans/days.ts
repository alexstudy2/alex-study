import { MAX_PLAN_DAYS, addDayKey, dayKeyRange, dayKeySpan } from "@/lib/plan-forum/dates";

/**
 * Day-key arithmetic for the AI Exam Plan -- the planning window handed to the model, the rest days
 * inside it, and the period a published plan occupies on the Plan Forum board.
 *
 * Everything here is string work on `YYYY-MM-DD` keys, which sort lexicographically exactly as they
 * sort chronologically, so no instant is ever constructed and no timezone question arises. Kept out
 * of ./ai.ts and ./publish.ts (both `server-only`) so it can be tested without a database.
 */

export type ForumPeriod = { startDate: string; endDate: string };

/**
 * How much of the run-up to the exam the plan actually covers.
 *
 * An exam six months out does not want a 180-day wall of sticky notes: the Plan Forum board draws
 * one note per day and caps a plan at `MAX_PLAN_DAYS`, so a proposal longer than that could never be
 * published or read. The plan therefore starts at most `MAX_PLAN_DAYS - 1` days before the exam, and
 * the prompt asks the model to say so in its overview.
 */
export function planWindow(currentDateKey: string, examDateKey: string) {
  const earliest = addDayKey(examDateKey, -(MAX_PLAN_DAYS - 1));
  return { planFrom: earliest > currentDateKey ? earliest : currentDateKey, planTo: examDateKey };
}

/**
 * The rest days as dates rather than weekday numbers.
 *
 * The model is far more reliable told "put nothing on 2026-08-21, 2026-08-28" than told "skip
 * Fridays" and left to work out which dates those are. Noon UTC anchors the weekday lookup: any
 * hour between 03:00 and 21:00 UTC lands on the same calendar day in Cairo whatever the offset.
 */
export function restDatesInWindow(planFrom: string, planTo: string, restDays: number[]) {
  if (!restDays.length) return [];
  const wanted = new Set(restDays);
  return dayKeyRange(planFrom, planTo).filter((key) =>
    wanted.has(new Date(`${key}T12:00:00Z`).getUTCDay()),
  );
}

/**
 * The period a published exam plan occupies on the forum board. Getting these two keys wrong is the
 * difference between a readable board and a plan that either hides its own items or unrolls hundreds
 * of empty notes.
 */
export function forumPeriodForItems(
  itemDayKeys: string[],
  examDayKey: string,
): { period: ForumPeriod; error: null } | { period: null; error: "no_items" | "period_too_long" } {
  if (!itemDayKeys.length) return { period: null, error: "no_items" };

  const earliest = itemDayKeys.reduce((min, key) => (key < min ? key : min));
  const latest = itemDayKeys.reduce((max, key) => (key > max ? key : max));

  const startDate = earliest < examDayKey ? earliest : examDayKey;
  // Normally the exam closes the plan. `latest` only wins if the student edited an item onto or past
  // the exam day, and an item outside its own plan's period would simply never render.
  const endDate = latest > examDayKey ? latest : examDayKey;

  if (dayKeySpan(startDate, endDate) > MAX_PLAN_DAYS)
    return { period: null, error: "period_too_long" };
  return { period: { startDate, endDate }, error: null };
}
