import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import {
  AI_GLOBAL_DAILY_TOKEN_LIMIT,
  AI_USER_DAILY_JOB_LIMIT,
  AI_USER_DAILY_TOKEN_LIMIT,
  assessAIAllowance,
  hashAIInput,
  typeDailyLimit,
} from "@/lib/ai/policy";
import {
  acceptExamPlanSchema,
  deriveExamPlanStatus,
  examPlanGenerateSchema,
  examWindowError,
  generatedExamPlanSchema,
  proposalDatesAreValid,
} from "@/lib/exam-plans/validation";
import {
  buildWeeklyRecapSignal,
  detectBestTime,
  detectBurnoutRisk,
  detectPerformanceDrop,
  type PersonalSignalData,
  type SignalSession,
} from "@/lib/insights/signals";

const NOW = new Date("2026-08-16T09:00:00.000Z");

function session(
  day: string,
  minutes: number,
  options: {
    focus?: number;
    distractions?: number;
    plannedMinutes?: number;
    cairoHour?: number;
  } = {},
): SignalSession {
  const hour = String(options.cairoHour ?? 18).padStart(2, "0");
  return {
    startedAt: fromZonedTime(`${day}T${hour}:00:00`, "Africa/Cairo"),
    durationSeconds: minutes * 60,
    plannedDurationSeconds: (options.plannedMinutes ?? minutes) * 60,
    distractionCount: options.distractions ?? 0,
    focusScore: options.focus ?? 85,
    subjectName: "Anatomy",
  };
}

function data(sessions: SignalSession[]): PersonalSignalData {
  return { sessions, tasks: [] };
}

describe("Phase 10 deterministic insight signals", () => {
  it("builds a completed Cairo-week recap without competitive context", () => {
    const signal = buildWeeklyRecapSignal(
      data([session("2026-08-10", 60), session("2026-08-12", 60), session("2026-08-03", 45)]),
      NOW,
    );
    expect(signal?.type).toBe("WEEKLY_RECAP");
    expect(signal?.facts.studyMinutes).toBe(120);
    expect(signal?.facts.previousStudyMinutes).toBe(45);
    expect(JSON.stringify(signal)).not.toContain("challenge");
  });

  it("requires a material baseline before reporting a performance drop", () => {
    const baseline = ["02", "03", "04", "05"].map((day) => session(`2026-08-${day}`, 60));
    const recent = [session("2026-08-10", 45), session("2026-08-12", 45)];
    const signal = detectPerformanceDrop(data([...baseline, ...recent]), NOW);
    expect(signal?.type).toBe("PERFORMANCE_DROP");
    expect(signal?.facts.previousValue).toBe(240);
    expect(signal?.facts.recentValue).toBe(90);
    expect(
      detectPerformanceDrop(data([session("2026-08-03", 60), session("2026-08-10", 20)]), NOW),
    ).toBeNull();
  });

  it("keeps workload detection conservative and explicitly non-diagnostic", () => {
    const previous = ["02", "03", "04", "05", "06", "07", "08"].map((day) =>
      session(`2026-08-${day}`, 90, { focus: 91 }),
    );
    const strained = ["09", "10", "11", "12", "13", "14", "15"].map((day) =>
      session(`2026-08-${day}`, 180, { focus: 70, distractions: 5 }),
    );
    const signal = detectBurnoutRisk(data([...previous, ...strained]), NOW);
    expect(signal?.type).toBe("BURNOUT");
    expect(signal?.facts.noticeKind).toBe("workload_check_in_not_diagnosis");
    const loadWithoutStrain = strained.map((item) => ({
      ...item,
      focusScore: 88,
      distractionCount: 0,
    }));
    expect(detectBurnoutRisk(data([...previous, ...loadWithoutStrain]), NOW)).toBeNull();
  });

  it("recommends a time window only after repeated scored sessions", () => {
    const evening = ["01", "04", "08", "12"].map((day) =>
      session(`2026-08-${day}`, 45, { focus: 93, cairoHour: 18 }),
    );
    const morning = ["02", "06", "10"].map((day) =>
      session(`2026-08-${day}`, 45, { focus: 75, cairoHour: 9 }),
    );
    const signal = detectBestTime(data([...evening, ...morning]), NOW);
    expect(signal?.type).toBe("BEST_TIME");
    expect(signal?.facts.timeWindow).toBe("evening");
    expect(detectBestTime(data(evening.slice(0, 2)), NOW)).toBeNull();
  });
});

describe("Phase 10 AI cost and audit policy", () => {
  it("hashes equivalent structured inputs deterministically", () => {
    expect(hashAIInput({ b: 2, a: { y: 2, x: 1 } })).toBe(hashAIInput({ a: { x: 1, y: 2 }, b: 2 }));
  });

  it("enforces global, user, job, and per-operation ceilings", () => {
    const base = { globalTokens: 0, userTokens: 0, userJobs: 0, typeJobs: 0 };
    expect(assessAIAllowance({ ...base, type: "EXAM_PLAN" })).toBeNull();
    expect(
      assessAIAllowance({
        ...base,
        type: "EXAM_PLAN",
        globalTokens: AI_GLOBAL_DAILY_TOKEN_LIMIT,
      }),
    ).toBe("ai_budget_exhausted");
    expect(
      assessAIAllowance({
        ...base,
        type: "EXAM_PLAN",
        userTokens: AI_USER_DAILY_TOKEN_LIMIT,
      }),
    ).toBe("ai_budget_exhausted");
    expect(
      assessAIAllowance({
        ...base,
        type: "EXAM_PLAN",
        userJobs: AI_USER_DAILY_JOB_LIMIT,
      }),
    ).toBe("ai_rate_limited");
    expect(
      assessAIAllowance({ ...base, type: "EXAM_PLAN", typeJobs: typeDailyLimit("EXAM_PLAN") }),
    ).toBe("ai_rate_limited");
    // An unknown type falls back to one job a day, so a new insight cannot quietly become unlimited.
    expect(assessAIAllowance({ ...base, type: "SOMETHING_NEW", typeJobs: 1 })).toBe(
      "ai_rate_limited",
    );
  });
});

describe("Phase 10 exam-plan validation and confirmation", () => {
  it("accepts only bounded structured plan proposals", () => {
    const proposal = {
      overview: "Alternate recall and practice blocks.",
      items: [
        {
          title: "Upper limb recall",
          notes: null,
          subjectName: "Anatomy",
          plannedDate: "2026-08-20",
          estimatedMinutes: 45,
        },
      ],
    };
    expect(generatedExamPlanSchema.safeParse(proposal).success).toBe(true);
    expect(
      generatedExamPlanSchema.safeParse({
        ...proposal,
        items: [{ ...proposal.items[0], plannedDate: "20/08/2026" }],
      }).success,
    ).toBe(false);
    expect(proposalDatesAreValid(proposal.items, new Date("2026-08-30T20:59:00.000Z"), NOW)).toBe(
      true,
    );
  });

  it("normalizes a Cairo date input and rejects unsafe exam windows", () => {
    const parsed = examPlanGenerateSchema.parse({
      title: "Neuro final",
      examAt: "2026-09-01",
      syllabusText: "Brainstem, cranial nerves, motor pathways, and sensory pathways.",
    });
    expect(parsed.examAt).toContain("T");
    expect(examWindowError(new Date("2026-08-16T12:00:00.000Z"), NOW)).toBe("exam_too_soon");
  });

  it("requires literal task-creation confirmation and derives partial states", () => {
    const ids = ["11111111-1111-4111-8111-111111111111"];
    expect(
      acceptExamPlanSchema.safeParse({ itemIds: ids, confirmTaskCreation: true }).success,
    ).toBe(true);
    expect(
      acceptExamPlanSchema.safeParse({ itemIds: ids, confirmTaskCreation: false }).success,
    ).toBe(false);
    expect(deriveExamPlanStatus({ totalItems: 3, acceptedItems: 1, closed: false })).toBe(
      "PARTIALLY_ACCEPTED",
    );
    expect(deriveExamPlanStatus({ totalItems: 3, acceptedItems: 3, closed: false })).toBe(
      "ACCEPTED",
    );
    expect(deriveExamPlanStatus({ totalItems: 3, acceptedItems: 0, closed: true })).toBe(
      "REJECTED",
    );
  });
});
