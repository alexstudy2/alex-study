import { describe, expect, it } from "vitest";
import { toZonedTime } from "date-fns-tz";
import { getTaskDateWindow, nextRecurrenceDate } from "@/lib/tasks/dates";
import { buildTaskWhere } from "@/lib/tasks/queries";
import { bulkSchema, reorderSchema, taskInputSchema } from "@/lib/tasks/validation";
import { parsedTaskDraftSchema } from "@/lib/tasks/ai";

describe("task date filters", () => {
  const now = new Date("2026-08-15T23:30:00.000Z");
  it("uses Cairo local day boundaries", () => {
    const window = getTaskDateWindow("today", now);
    if (!window?.gte || !window.lte) throw new Error("missing date window");
    expect(window.gte.toISOString()).toBe("2026-08-15T21:00:00.000Z");
    expect(window.lte.toISOString()).toBe("2026-08-16T20:59:59.999Z");
  });
  it("starts the week on Sunday", () => {
    const window = getTaskDateWindow("week", now);
    if (!window?.gte) throw new Error("missing date window");
    expect(toZonedTime(window.gte, "Africa/Cairo").getDay()).toBe(0);
  });
  it("scopes every task query to its owner and excludes deleted tasks", () => {
    const where = buildTaskWhere("user-1", "overdue", now);
    expect(where.userId).toBe("user-1");
    expect(where.deletedAt).toBeNull();
    expect(where.dueAt).toBeTruthy();
  });
});

describe("recurrence", () => {
  it("advances daily tasks without losing Cairo wall time", () => {
    const next = nextRecurrenceDate(new Date("2026-08-16T06:00:00.000Z"), {
      frequency: "DAILY",
      interval: 1,
    });
    expect(next.toISOString()).toBe("2026-08-17T06:00:00.000Z");
  });
  it("advances weekly tasks to an allowed weekday", () => {
    const next = nextRecurrenceDate(new Date("2026-08-16T06:00:00.000Z"), {
      frequency: "WEEKLY",
      interval: 1,
      weekDays: [3],
    });
    expect(toZonedTime(next, "Africa/Cairo").getDay()).toBe(3);
  });
});

describe("task validation and ordering", () => {
  it("rejects invalid estimates and blank titles", () => {
    expect(taskInputSchema.safeParse({ title: "", estimatedMinutes: 2 }).success).toBe(false);
  });
  it("requires unique-shaped UUID ordering input", () => {
    expect(reorderSchema.safeParse({ taskIds: ["not-an-id"] }).success).toBe(false);
    expect(
      reorderSchema.safeParse({ taskIds: ["11111111-1111-4111-8111-111111111111"] }).success,
    ).toBe(true);
  });
  it("requires a priority for bulk priority changes", () => {
    expect(
      bulkSchema.safeParse({
        taskIds: ["11111111-1111-4111-8111-111111111111"],
        action: "PRIORITY",
      }).success,
    ).toBe(false);
  });
});

describe("AI draft confirmation boundary", () => {
  it("validates parsed proposals independently of task creation", () => {
    const parsed = parsedTaskDraftSchema.safeParse({
      title: "Review renal physiology",
      notes: null,
      subjectName: "Physiology",
      priority: "HIGH",
      dueAt: null,
      estimatedMinutes: 45,
      recurrenceRule: null,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.title).toBe("Review renal physiology");
  });
});
