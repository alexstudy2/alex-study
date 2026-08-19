import { describe, expect, it } from "vitest";
import { PLAN_COLOR_TOKENS, normalizeLabel, planColorToken, safeColorToken } from "@/lib/plan-forum/colors";
import {
  MAX_PLAN_DAYS,
  addDayKey,
  cairoDayAt9,
  cairoDayStart,
  dayKeyRange,
  dayKeySpan,
  isDayInPlan,
  planDayCount,
  planDayKeys,
} from "@/lib/plan-forum/dates";
import { canViewPlan } from "@/lib/plan-forum/permissions";
import {
  planInputSchema,
  planItemInputSchema,
  planPatchSchema,
} from "@/lib/plan-forum/validation";

/**
 * Plan Forum unit tests -- pure functions only, no database, in the shape of tests/phase10.test.ts.
 *
 * The three things worth guarding here are the three that fail silently: a day walk that loses a
 * day to DST, a colour hash that drifts so a shared note changes paper on somebody else's screen,
 * and `canViewPlan`, which is the one predicate in this feature where a mistake leaks a student's
 * work to their whole year.
 */

const viewer = { id: "me", academicYear: 3 };

describe("plan day keys", () => {
  it("counts both ends of a span", () => {
    expect(dayKeySpan("2026-08-19", "2026-08-19")).toBe(1);
    expect(dayKeySpan("2026-08-19", "2026-09-01")).toBe(14);
  });

  it("reports a reversed range as under one day", () => {
    expect(dayKeySpan("2026-08-19", "2026-08-18")).toBe(0);
    expect(dayKeyRange("2026-08-19", "2026-08-18")).toEqual([]);
  });

  it("walks a month boundary without skipping or repeating", () => {
    const keys = dayKeyRange("2026-08-28", "2026-09-03");
    expect(keys).toEqual([
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /* Egypt springs forward at 00:00 (so 24 Apr 2026 has no local midnight) and falls back in
     October. A local +86400000 walk would emit one key twice and skip another across either
     boundary; these two ranges are where that bug would land. */
  it("survives both Cairo DST transitions", () => {
    const spring = dayKeyRange("2026-04-22", "2026-04-26");
    expect(spring).toEqual(["2026-04-22", "2026-04-23", "2026-04-24", "2026-04-25", "2026-04-26"]);
    const autumn = dayKeyRange("2026-10-28", "2026-11-01");
    expect(autumn).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(new Set([...spring, ...autumn]).size).toBe(10);
  });

  it("steps a key forward and back", () => {
    expect(addDayKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDayKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDayKey("2028-03-01", -1)).toBe("2028-02-29");
  });

  /* A late-evening UTC instant is already the next day in Cairo (+02:00/+03:00), which is the case
     that separates "convert in Cairo" from "convert in UTC and hope". */
  it("reads a stored period in Cairo, not UTC", () => {
    const start = new Date("2026-08-18T21:30:00.000Z");
    const end = new Date("2026-08-20T21:30:00.000Z");
    expect(planDayKeys(start, end)).toEqual(["2026-08-19", "2026-08-20", "2026-08-21"]);
    expect(planDayCount(start, end)).toBe(3);
  });

  it("places a day's first instant and its 09:00 in Cairo", () => {
    // Cairo is +03:00 in August, so local midnight is 21:00 UTC the day before.
    expect(cairoDayStart("2026-08-19").toISOString()).toBe("2026-08-18T21:00:00.000Z");
    expect(cairoDayAt9("2026-08-19").toISOString()).toBe("2026-08-19T06:00:00.000Z");
  });

  it("keeps items inside the plan's period", () => {
    const start = new Date("2026-08-18T21:00:00.000Z");
    const end = new Date("2026-08-24T21:00:00.000Z");
    expect(isDayInPlan("2026-08-19", start, end)).toBe(true);
    expect(isDayInPlan("2026-08-25", start, end)).toBe(true);
    expect(isDayInPlan("2026-08-26", start, end)).toBe(false);
    expect(isDayInPlan("2026-08-18", start, end)).toBe(false);
  });
});

describe("plan validation", () => {
  const base = { title: "Anatomy final", startDate: "2026-08-19", endDate: "2026-09-01" };

  it("accepts a normal plan", () => {
    expect(planInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a reversed period", () => {
    const result = planInputSchema.safeParse({ ...base, endDate: "2026-08-18" });
    expect(result.success).toBe(false);
  });

  it("accepts exactly the cap and rejects one day past it", () => {
    const start = "2026-08-19";
    expect(dayKeySpan(start, addDayKey(start, MAX_PLAN_DAYS - 1))).toBe(MAX_PLAN_DAYS);
    expect(
      planInputSchema.safeParse({ ...base, endDate: addDayKey(start, MAX_PLAN_DAYS - 1) }).success,
    ).toBe(true);
    expect(
      planInputSchema.safeParse({ ...base, endDate: addDayKey(start, MAX_PLAN_DAYS) }).success,
    ).toBe(false);
  });

  it("rejects an empty title and a non-date", () => {
    expect(planInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, startDate: "19-08-2026" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, startDate: "2026-02-30" }).success).toBe(false);
  });

  it("takes a visibility change on its own", () => {
    expect(planPatchSchema.safeParse({ visibility: "CLASS" }).success).toBe(true);
    expect(planPatchSchema.safeParse({}).success).toBe(false);
  });

  /* One bound alone cannot be checked against the other without reading the row, and a
     half-validated range is how an inverted period gets stored. */
  it("requires both period bounds together", () => {
    expect(planPatchSchema.safeParse({ startDate: "2026-08-19" }).success).toBe(false);
    expect(planPatchSchema.safeParse({ endDate: "2026-08-19" }).success).toBe(false);
    expect(
      planPatchSchema.safeParse({ startDate: "2026-08-19", endDate: "2026-08-25" }).success,
    ).toBe(true);
  });

  it("trims an item and caps its subject label", () => {
    const parsed = planItemInputSchema.safeParse({
      title: "  Read chapter 4  ",
      subjectLabel: "  Anatomy ",
      dayDate: "2026-08-19",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Read chapter 4");
      expect(parsed.data.subjectLabel).toBe("Anatomy");
    }
    expect(
      planItemInputSchema.safeParse({ title: "x", subjectLabel: "   ", dayDate: "2026-08-19" })
        .success,
    ).toBe(false);
    expect(
      planItemInputSchema.safeParse({ title: "x", subjectLabel: "a".repeat(61), dayDate: "2026-08-19" })
        .success,
    ).toBe(false);
  });
});

describe("plan colours", () => {
  it("gives one label the same colour every time", () => {
    expect(planColorToken("Anatomy")).toBe(planColorToken("Anatomy"));
  });

  /* This is the shared-plan case: the author types "Anatomy", a classmate's copy of the label may
     arrive as "anatomy  " through a form, and the note must still be the same colour on both
     screens -- otherwise a shared plan visibly changes when it changes hands. */
  it("ignores case and repeated spaces", () => {
    expect(planColorToken("anatomy")).toBe(planColorToken("  ANATOMY  "));
    expect(planColorToken("Clinical  Pathology")).toBe(planColorToken("clinical pathology"));
    expect(normalizeLabel("  Clinical   Pathology ")).toBe("clinical pathology");
  });

  it("only ever returns a token the stylesheet resolves", () => {
    const labels = [
      "Anatomy", "Physiology", "Biochemistry", "Histology", "Pharmacology", "Pathology",
      "Microbiology", "Parasitology", "Surgery", "Medicine", "Paediatrics", "Obstetrics",
      "Radiology", "Forensics", "Community", "Ophthalmology", "ENT", "Neurology",
      "Cardiology", "Anaesthesia",
    ];
    const seen = new Set(labels.map(planColorToken));
    for (const token of seen) expect(PLAN_COLOR_TOKENS).toContain(token);
    // A hash that collapsed onto two or three tokens would technically pass the check above and
    // still make a whole shelf one colour.
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it("falls back rather than passing a stray token through to CSS", () => {
    expect(PLAN_COLOR_TOKENS).toContain(safeColorToken("chartreuse"));
    expect(PLAN_COLOR_TOKENS).toContain(safeColorToken(null));
    expect(safeColorToken("violet")).toBe("violet");
  });

  it("gives an empty label a real colour", () => {
    expect(PLAN_COLOR_TOKENS).toContain(planColorToken(""));
    expect(PLAN_COLOR_TOKENS).toContain(planColorToken("   "));
  });
});

describe("canViewPlan", () => {
  const mine = { authorId: "me", visibility: "PRIVATE" as const, academicYear: 3 };
  const theirs = { authorId: "them", visibility: "CLASS" as const, academicYear: 3 };

  it("lets an author read their own private plan", () => {
    expect(canViewPlan(viewer, mine, false)).toBe(true);
  });

  it("lets the author's year read a shared plan", () => {
    expect(canViewPlan(viewer, theirs, false)).toBe(true);
  });

  it("keeps a shared plan away from another year", () => {
    expect(canViewPlan(viewer, { ...theirs, academicYear: 4 }, false)).toBe(false);
  });

  it("keeps a private plan away from the whole year", () => {
    expect(canViewPlan(viewer, { ...theirs, visibility: "PRIVATE" }, false)).toBe(false);
  });

  /* A bookmark outlives the share. Unsharing stops new readers; it does not retract from someone
     whose shelf already holds the plan and who has read it. */
  it("keeps access for someone who already saved it", () => {
    expect(canViewPlan(viewer, { ...theirs, visibility: "PRIVATE" }, true)).toBe(true);
    expect(canViewPlan(viewer, { ...theirs, academicYear: 4, visibility: "PRIVATE" }, true)).toBe(true);
  });
});
