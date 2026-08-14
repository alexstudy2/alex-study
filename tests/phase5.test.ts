import { describe, expect, it } from "vitest";
import { toZonedTime } from "date-fns-tz";
import { calendarWindow, cairoDateKey } from "@/lib/calendar/dates";
import { calculateGoalProgress, daysRemaining } from "@/lib/goals/progress";
import { goalInputSchema, goalPatchSchema } from "@/lib/goals/validation";

describe("goal progress", () => {
  it("derives study-minute and task progress", () => {
    expect(
      calculateGoalProgress({ metric: "STUDY_MINUTES", targetValue: 600, studySeconds: 18_000 }),
    ).toEqual({ currentValue: 300, percentage: 50, complete: false });
    expect(
      calculateGoalProgress({ metric: "TASKS_COMPLETED", targetValue: 4, tasksCompleted: 5 }),
    ).toEqual({ currentValue: 5, percentage: 100, complete: true });
  });
  it("reports remaining whole-day urgency", () => {
    expect(daysRemaining(new Date("2026-08-17T12:00:00Z"), new Date("2026-08-14T12:00:00Z"))).toBe(
      3,
    );
  });
});

describe("goal validation", () => {
  it("requires a positive target and chronological dates", () => {
    expect(
      goalInputSchema.safeParse({
        title: "Anatomy week",
        metric: "STUDY_MINUTES",
        targetValue: 300,
        period: "WEEKLY",
        startsAt: "2026-08-14T00:00:00.000Z",
        deadline: "2026-08-20T00:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      goalInputSchema.safeParse({
        title: "Bad",
        metric: "STUDY_MINUTES",
        targetValue: 0,
        period: "WEEKLY",
        startsAt: "2026-08-20T00:00:00.000Z",
        deadline: "2026-08-14T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
  it("accepts status-only ownership-scoped updates", () => {
    expect(goalPatchSchema.safeParse({ status: "COMPLETED" }).success).toBe(true);
  });
});

describe("Cairo calendar windows", () => {
  it("starts calendar weeks on Sunday", () => {
    const window = calendarWindow(new Date("2026-08-19T12:00:00Z"), "week");
    expect(toZonedTime(window.start, "Africa/Cairo").getDay()).toBe(0);
  });
  it("produces stable Cairo date keys near UTC midnight", () => {
    expect(cairoDateKey(new Date("2026-08-14T22:30:00Z"))).toBe("2026-08-15");
  });
});
