import { describe, expect, it } from "vitest";
import {
  eligibleSessions,
  eligibleTasks,
  progressEventRevision,
  publicName,
  rankedRows,
  resolveChallenge,
  utcLeaderboardWeek,
} from "@/lib/challenges/rules";
import { challengeInputSchema, privacySchema } from "@/lib/challenges/validation";

const at = (minute: number) => new Date(Date.UTC(2026, 7, 10, 10, minute));

function task(id: string, minute: number, estimatedMinutes = 10, subjectKey: string | null = null) {
  return {
    id,
    completedAt: at(minute),
    estimatedMinutes,
    status: "COMPLETED",
    deletedAt: null,
    parentTaskId: null,
    subjectKey,
  };
}

function session(id: string, minute: number, source = "SOLO", subjectKey: string | null = null) {
  return {
    id,
    endedAt: at(minute),
    durationSeconds: 1500,
    status: "COMPLETED",
    source,
    subjectKey,
  };
}

describe("competitive task eligibility", () => {
  it("requires at least ten estimated minutes", () => {
    expect(eligibleTasks([task("short", 0, 9), task("eligible", 5, 10)]).map((x) => x.id)).toEqual([
      "eligible",
    ]);
  });

  it("counts at most one eligible task every five minutes", () => {
    expect(
      eligibleTasks([task("first", 0), task("too-soon", 4), task("boundary", 5)]).map((x) => x.id),
    ).toEqual(["first", "boundary"]);
  });

  it("matches subject snapshots and ignores subtasks, deleted tasks, and other subjects", () => {
    expect(
      eligibleTasks(
        [
          task("anatomy", 0, 20, "anatomy"),
          task("physiology", 5, 20, "physiology"),
          { ...task("subtask", 10, 20, "anatomy"), parentTaskId: "parent" },
          { ...task("deleted", 15, 20, "anatomy"), deletedAt: at(16) },
        ],
        "anatomy",
      ).map((x) => x.id),
    ).toEqual(["anatomy"]);
  });
});

describe("competitive session eligibility", () => {
  it("excludes manual sessions and supports normalized subject matching", () => {
    expect(
      eligibleSessions(
        [
          session("timer", 0, "SOLO", "anatomy"),
          session("manual", 5, "MANUAL", "anatomy"),
          session("other-subject", 10, "SOLO", "physiology"),
        ],
        "anatomy",
      ).map((x) => x.id),
    ).toEqual(["timer"]);
  });
});

describe("adjustments and deterministic resolution", () => {
  it("labels later source corrections as adjustments, including re-eligibility", () => {
    const source = progressEventRevision({
      current: 0,
      wanted: 1,
      hasHistory: false,
      sourceOccurredAt: at(0),
      now: at(1),
    });
    const removal = progressEventRevision({
      current: 1,
      wanted: 0,
      hasHistory: true,
      sourceOccurredAt: at(0),
      now: at(2),
    });
    const restored = progressEventRevision({
      current: 0,
      wanted: 1,
      hasHistory: true,
      sourceOccurredAt: at(0),
      now: at(3),
    });
    expect(source).toMatchObject({ eventType: "SOURCE", delta: 1, occurredAt: at(0) });
    expect(removal).toMatchObject({ eventType: "ADJUSTMENT", delta: -1, occurredAt: at(2) });
    expect(restored).toMatchObject({ eventType: "ADJUSTMENT", delta: 1, occurredAt: at(3) });
  });

  it("can reopen a target-first result after a correction", () => {
    const common = {
      resolutionType: "TARGET_FIRST" as const,
      targetValue: 2,
      startsAt: at(0),
      endsAt: at(30),
      now: at(10),
    };
    expect(
      resolveChallenge({
        ...common,
        participants: [
          { userId: "a", value: 2, targetReachedAt: at(8) },
          { userId: "b", value: 1, targetReachedAt: null },
        ],
      }),
    ).toEqual({ status: "COMPLETED", winnerId: "a" });
    expect(
      resolveChallenge({
        ...common,
        participants: [
          { userId: "a", value: 1, targetReachedAt: null },
          { userId: "b", value: 1, targetReachedAt: null },
        ],
      }),
    ).toEqual({ status: "ACTIVE", winnerId: null });
  });

  it("handles target-first wins, simultaneous draws, and expiration", () => {
    const common = { targetValue: 3, startsAt: at(0), endsAt: at(20) };
    expect(
      resolveChallenge({
        ...common,
        resolutionType: "TARGET_FIRST",
        now: at(10),
        participants: [
          { userId: "a", value: 3, targetReachedAt: at(7) },
          { userId: "b", value: 3, targetReachedAt: at(8) },
        ],
      }),
    ).toEqual({ status: "COMPLETED", winnerId: "a" });
    expect(
      resolveChallenge({
        ...common,
        resolutionType: "TARGET_FIRST",
        now: at(10),
        participants: [
          { userId: "a", value: 3, targetReachedAt: at(7) },
          { userId: "b", value: 3, targetReachedAt: at(7) },
        ],
      }),
    ).toEqual({ status: "COMPLETED", winnerId: null });
    expect(
      resolveChallenge({
        ...common,
        resolutionType: "TARGET_FIRST",
        now: at(21),
        participants: [
          { userId: "a", value: 2, targetReachedAt: null },
          { userId: "b", value: 1, targetReachedAt: null },
        ],
      }),
    ).toEqual({ status: "EXPIRED", winnerId: null });
  });

  it("resolves deadline leaders and exact ties", () => {
    const common = {
      resolutionType: "DEADLINE_LEADER" as const,
      targetValue: 300,
      startsAt: at(0),
      endsAt: at(20),
      now: at(21),
    };
    expect(
      resolveChallenge({
        ...common,
        participants: [
          { userId: "a", value: 90, targetReachedAt: null },
          { userId: "b", value: 75, targetReachedAt: null },
        ],
      }),
    ).toEqual({ status: "COMPLETED", winnerId: "a" });
    expect(
      resolveChallenge({
        ...common,
        participants: [
          { userId: "a", value: 90, targetReachedAt: null },
          { userId: "b", value: 90, targetReachedAt: null },
        ],
      }),
    ).toEqual({ status: "COMPLETED", winnerId: null });
  });
});

describe("weekly leaderboard rules", () => {
  it("uses Monday 00:00 UTC as the canonical weekly boundary", () => {
    expect(utcLeaderboardWeek(new Date("2026-08-14T23:59:59.000Z"))).toEqual({
      start: new Date("2026-08-10T00:00:00.000Z"),
      end: new Date("2026-08-17T00:00:00.000Z"),
    });
    expect(utcLeaderboardWeek(new Date("2026-08-17T00:00:00.000Z")).start).toEqual(
      new Date("2026-08-17T00:00:00.000Z"),
    );
  });

  it("gives equal primary totals the same rank", () => {
    expect(
      rankedRows([
        { name: "Mariam", value: 120, secondaryValue: 2 },
        { name: "Omar", value: 120, secondaryValue: 4 },
        { name: "Nour", value: 90, secondaryValue: 8 },
      ]).map(({ name, rank }) => ({ name, rank })),
    ).toEqual([
      { name: "Omar", rank: 1 },
      { name: "Mariam", rank: 1 },
      { name: "Nour", rank: 3 },
    ]);
  });
});

describe("challenge validation and public identity", () => {
  const base = {
    opponentId: "9d72e0f4-9d0d-4b16-a86f-f64da381c9fb",
    type: "TASK_COUNT",
    resolutionType: "TARGET_FIRST",
    targetValue: 5,
    startsAt: "2026-08-14T10:00:00.000Z",
    endsAt: "2026-08-21T10:00:00.000Z",
  };

  it("requires subjects for subject modes and bounds duration and targets", () => {
    expect(challengeInputSchema.safeParse(base).success).toBe(true);
    expect(challengeInputSchema.safeParse({ ...base, type: "SUBJECT_TASK_COUNT" }).success).toBe(
      false,
    );
    expect(challengeInputSchema.safeParse({ ...base, targetValue: 101 }).success).toBe(false);
    expect(
      challengeInputSchema.safeParse({ ...base, endsAt: "2026-10-01T10:00:00.000Z" }).success,
    ).toBe(false);
    expect(privacySchema.safeParse({}).success).toBe(false);
    expect(privacySchema.safeParse({ leaderboardVisible: false }).success).toBe(true);
  });

  it("defaults public cards to first name while allowing explicit full-name sharing", () => {
    expect(publicName("Mariam Hassan", false)).toBe("Mariam");
    expect(publicName("Mariam Hassan", true)).toBe("Mariam Hassan");
    expect(publicName("   ", false)).toBe("Student");
  });
});
