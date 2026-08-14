import { describe, expect, it } from "vitest";
import { activeSeconds, focusScore, remainingSeconds } from "@/lib/sessions/timer";
import {
  distractionSchema,
  manualSessionSchema,
  timerActionSchema,
  timerStartSchema,
} from "@/lib/sessions/validation";

describe("server-authoritative timer lifecycle", () => {
  it("derives running time from server timestamps after refresh or sleep", () => {
    const run = {
      status: "RUNNING" as const,
      durationSeconds: 1500,
      segmentStartedAt: new Date("2026-08-14T10:00:00Z"),
      accumulatedActiveSeconds: 120,
    };
    const now = new Date("2026-08-14T10:03:30Z");
    expect(activeSeconds(run, now)).toBe(330);
    expect(remainingSeconds(run, now)).toBe(1170);
  });
  it("freezes elapsed time while paused", () => {
    const run = {
      status: "PAUSED" as const,
      durationSeconds: 1500,
      segmentStartedAt: null,
      accumulatedActiveSeconds: 420,
    };
    expect(activeSeconds(run, new Date("2030-01-01T00:00:00Z"))).toBe(420);
  });
  it("caps recovered elapsed time at the planned duration", () => {
    const run = {
      status: "RUNNING" as const,
      durationSeconds: 300,
      segmentStartedAt: new Date("2026-08-14T10:00:00Z"),
      accumulatedActiveSeconds: 0,
    };
    expect(activeSeconds(run, new Date("2026-08-14T12:00:00Z"))).toBe(300);
    expect(remainingSeconds(run, new Date("2026-08-14T12:00:00Z"))).toBe(0);
  });
});

describe("Focus Score", () => {
  it("uses the final planned/actual and distraction formula", () => {
    expect(focusScore(1500, 1500, 0)).toBe(100);
    expect(focusScore(750, 1500, 0)).toBe(70);
  });
  it("penalizes distraction rate and remains capped", () => {
    expect(focusScore(1500, 1500, 5)).toBe(92);
    expect(focusScore(3600, 1500, 0)).toBe(100);
    expect(focusScore(0, 1500, 0)).toBe(0);
  });
});

describe("session API validation and authorization inputs", () => {
  it("requires bounded timer durations and optimistic versions", () => {
    expect(timerStartSchema.safeParse({ mode: "FOCUS", durationSeconds: 59 }).success).toBe(false);
    expect(timerStartSchema.safeParse({ mode: "FOCUS", durationSeconds: 1500 }).success).toBe(true);
    expect(timerActionSchema.safeParse({ version: 0 }).success).toBe(false);
  });
  it("validates manual session chronology", () => {
    expect(
      manualSessionSchema.safeParse({
        startedAt: "2026-08-14T10:00:00.000Z",
        endedAt: "2026-08-14T09:00:00.000Z",
        plannedDurationSeconds: 3600,
      }).success,
    ).toBe(false);
  });
  it("bounds distraction notes", () => {
    expect(distractionSchema.safeParse({ note: "x".repeat(241) }).success).toBe(false);
  });
});
