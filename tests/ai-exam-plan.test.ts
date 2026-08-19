import { describe, expect, it } from "vitest";
import { MAX_PLAN_DAYS, addDayKey, dayKeySpan } from "@/lib/plan-forum/dates";
import { forumPeriodForItems, planWindow, restDatesInWindow } from "@/lib/exam-plans/days";
import {
  type ExamItemKind,
  type ExamTopic,
  MAX_TOPICS,
  formatLoad,
  parseVisionTopics,
  proposalShapeError,
  renderSyllabusText,
} from "@/lib/exam-plans/topics";
import { examPlanGenerateSchema } from "@/lib/exam-plans/validation";

/**
 * AI Exam Plan unit tests -- pure functions only, no database, in the shape of tests/plan-forum.test.ts.
 *
 * These four groups are the places where a mistake is invisible from the outside: a syllabus that
 * renders differently on two identical presses of Generate silently stops hitting the re-use cache,
 * a topic list read off a photo can be wrong in ways nobody notices until a chapter is missing, a
 * proposal that ignores the question-solving choice looks like a perfectly good plan, and a forum
 * period off by one day hides the plan's own notes.
 */

const CARDIO: ExamTopic[] = [
  { title: "Heart failure", chapter: "Cardiology", weight: "HEAVY", confidence: "WEAK" },
  { title: "Arrhythmias", chapter: "Cardiology", weight: "NORMAL", confidence: "OK" },
  { title: "Spirometry", chapter: null, weight: "LIGHT", confidence: "STRONG" },
  { title: "Valve disease", chapter: "Cardiology", weight: "NORMAL", confidence: "OK" },
];

describe("renderSyllabusText", () => {
  /* Grouping pulls the fourth row up under the heading it belongs to, and the unlabelled row stays
     where its chapter first appeared rather than being shuffled to the end. */
  it("groups by chapter in first-appearance order and annotates only what differs", () => {
    expect(renderSyllabusText(CARDIO)).toBe(
      [
        "## Cardiology",
        "- Heart failure (heavy · weak)",
        "- Arrhythmias",
        "- Valve disease",
        "- Spirometry (light · strong)",
      ].join("\n"),
    );
  });

  /* This string is what `hashAIInput` keys the 15-minute re-use cache on, so two runs of the same
     rows must be byte-identical -- otherwise pressing Generate twice quietly bills twice. */
  it("returns the identical string for equal rows", () => {
    expect(renderSyllabusText(CARDIO)).toBe(renderSyllabusText(CARDIO.map((row) => ({ ...row }))));
  });

  it("renders a bare list with no headings", () => {
    expect(renderSyllabusText([{ title: "Osmosis", chapter: null, weight: "NORMAL", confidence: "OK" }])).toBe(
      "- Osmosis",
    );
  });
});

describe("examPlanGenerateSchema", () => {
  const topicsOnly = {
    title: "Cardio midterm",
    examAt: "2026-09-10",
    topics: [{ title: "Heart failure", weight: "HEAVY" as const }],
  };

  /* Pasting a blob is still a legal request: the wizard gained a composer, it did not remove the
     textarea, and every payload that worked before this feature must keep working. */
  it("still parses the legacy title/examAt/syllabusText payload", () => {
    const syllabusText = "Brainstem, cranial nerves, motor and sensory pathways.";
    const parsed = examPlanGenerateSchema.parse({
      title: "Neuro final",
      examAt: "2026-09-10",
      syllabusText,
    });
    expect(parsed.syllabusText).toBe(syllabusText);
    expect(parsed.topics).toEqual([]);
    expect(parsed.questionStrategy).toBe("INTEGRATED");
    expect(parsed.dailyCapacityMinutes).toBe(180);
    expect(parsed.restDays).toEqual([]);
    // A date-only input is the exam day's 23:59 in Cairo, which is +03:00 in September.
    expect(parsed.examAt).toBe("2026-09-10T20:59:00.000Z");
  });

  it("collapses topics into the syllabus text that gets stored and hashed", () => {
    const parsed = examPlanGenerateSchema.parse({
      title: "Cardio midterm",
      examAt: "2026-09-10T20:59:00.000Z",
      topics: [
        { title: "Heart failure", weight: "HEAVY" },
        { title: "Arrhythmias", chapter: "Cardiology" },
      ],
      questionStrategy: "DEDICATED_DAYS",
      dailyCapacityMinutes: "240",
      restDays: [5, 1, 5],
    });
    expect(parsed.syllabusText).toBe("- Heart failure (heavy)\n## Cardiology\n- Arrhythmias");
    expect(parsed.topics[1].chapter).toBe("Cardiology");
    expect(parsed.topics[0].confidence).toBe("OK");
    expect(parsed.questionStrategy).toBe("DEDICATED_DAYS");
    expect(parsed.dailyCapacityMinutes).toBe(240);
    // Deduplicated and sorted, so the prompt gets one clean list of weekdays.
    expect(parsed.restDays).toEqual([1, 5]);
    // A full instant is passed through untouched; only a date-only value is anchored to 23:59.
    expect(parsed.examAt).toBe("2026-09-10T20:59:00.000Z");
  });

  /* The 400 this feature started from: neither field filled, and the message has to land on a field
     the wizard can point at, because `invalid_request` is rendered from `fields`. */
  it("fails on topics when there is neither a topic nor a syllabus", () => {
    const result = examPlanGenerateSchema.safeParse({ title: "Empty", examAt: "2026-09-10" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path[0] === "topics")).toBe(true);
    expect(examPlanGenerateSchema.safeParse({ ...topicsOnly, syllabusText: "too short" }).success).toBe(
      false,
    );
  });

  it("bounds the daily capacity", () => {
    const capacity = (dailyCapacityMinutes: unknown) =>
      examPlanGenerateSchema.safeParse({ ...topicsOnly, dailyCapacityMinutes }).success;
    expect(capacity(30)).toBe(true);
    expect(capacity(600)).toBe(true);
    expect(capacity(29)).toBe(false);
    expect(capacity(601)).toBe(false);
    expect(capacity(180.5)).toBe(false);
  });

  /* Seven rest days would leave nowhere to put the plan, and 81 topics is a syllabus, not an exam. */
  it("refuses a week of rest days and an over-long topic list", () => {
    expect(
      examPlanGenerateSchema.safeParse({ ...topicsOnly, restDays: [0, 1, 2, 3, 4, 5] }).success,
    ).toBe(true);
    expect(
      examPlanGenerateSchema.safeParse({ ...topicsOnly, restDays: [0, 1, 2, 3, 4, 5, 6] }).success,
    ).toBe(false);
    const many = Array.from({ length: MAX_TOPICS + 1 }, (_, index) => ({ title: `Topic ${index}` }));
    expect(examPlanGenerateSchema.safeParse({ ...topicsOnly, topics: many }).success).toBe(false);
    expect(
      examPlanGenerateSchema.safeParse({ ...topicsOnly, topics: many.slice(0, MAX_TOPICS) }).success,
    ).toBe(true);
  });
});

describe("parseVisionTopics", () => {
  it("reads fenced JSON and drops the page numbers with it", () => {
    const fenced = [
      "```json",
      '{"topics":[{"title":"Heart failure","chapter":"Cardiology"},"Arrhythmias  ....  51"]}',
      "```",
    ].join("\n");
    const { topics, warning } = parseVisionTopics(fenced);
    expect(warning).toBe(null);
    expect(topics).toEqual([
      { title: "Heart failure", chapter: "Cardiology", weight: "NORMAL", confidence: "OK" },
      { title: "Arrhythmias", chapter: null, weight: "NORMAL", confidence: "OK" },
    ]);
  });

  /* Vision models are chatty, and the call deliberately does not use JSON mode -- several Groq
     vision models refuse `response_format` alongside an image. */
  it("finds bare JSON inside prose", () => {
    const prose = [
      "Sure! Here is what the index says:",
      '{"topics": ["Heart failure ..... 42", "Cranial nerve 7"]}',
      "Let me know if you want the next page.",
    ].join("\n");
    const { topics, warning } = parseVisionTopics(prose);
    expect(warning).toBe(null);
    // "Cranial nerve 7" keeps its number: a page tail needs two or more separator characters.
    expect(topics.map((topic) => topic.title)).toEqual(["Heart failure", "Cranial nerve 7"]);
  });

  it("reads an English list, turning headings into chapters", () => {
    const listed = [
      "Chapter 2 - Cardiology",
      "1) Heart failure .......... 42",
      "* Arrhythmias -- 51",
      "Respiratory:",
      "Spirometry",
      "42",
      "---",
    ].join("\n");
    const { topics, warning } = parseVisionTopics(listed);
    expect(warning).toBe("read_as_text");
    expect(topics).toEqual([
      { title: "Heart failure", chapter: "Chapter 2 - Cardiology", weight: "NORMAL", confidence: "OK" },
      { title: "Arrhythmias", chapter: "Chapter 2 - Cardiology", weight: "NORMAL", confidence: "OK" },
      { title: "Spirometry", chapter: "Respiratory", weight: "NORMAL", confidence: "OK" },
    ]);
  });

  /* The فهرس this feature was asked for. `\b` cannot fire between an Arabic letter and a space, so
     `/^الباب\b/` would have matched nothing and every heading here would have become a topic. */
  it("reads an Arabic فهرس, its headings and its Arabic-Indic page numbers", () => {
    const arabic = [
      "الباب الأول",
      "- فسيولوجيا القلب ....... ١٢",
      "٢. تشريح القلب ٤٥",
      "الفصل الثاني:",
      "- الجهاز التنفسي ..... ٩٩",
    ].join("\n");
    const { topics, warning } = parseVisionTopics(arabic);
    expect(warning).toBe("read_as_text");
    expect(topics).toEqual([
      { title: "فسيولوجيا القلب", chapter: "الباب الأول", weight: "NORMAL", confidence: "OK" },
      // One space before the number is not a page tail, so this title keeps its 45.
      { title: "تشريح القلب 45", chapter: "الباب الأول", weight: "NORMAL", confidence: "OK" },
      { title: "الجهاز التنفسي", chapter: "الفصل الثاني", weight: "NORMAL", confidence: "OK" },
    ]);
  });

  /* A multi-page index repeats its running header, and a doubled topic would double its study time. */
  it("drops a repeated title whatever its case", () => {
    const { topics } = parseVisionTopics(["Heart failure", "heart FAILURE", "Arrhythmias"].join("\n"));
    expect(topics.map((topic) => topic.title)).toEqual(["Heart failure", "Arrhythmias"]);
  });

  it("caps a long index and says so", () => {
    const raw = JSON.stringify({
      topics: Array.from({ length: MAX_TOPICS + 5 }, (_, index) => `Topic ${index} of the syllabus`),
    });
    const { topics, warning } = parseVisionTopics(raw);
    expect(topics).toHaveLength(MAX_TOPICS);
    expect(warning).toBe("truncated");
  });

  it("reports an unreadable photo rather than inventing rows", () => {
    expect(parseVisionTopics("")).toEqual({ topics: [], warning: "nothing_read" });
    expect(parseVisionTopics("```\n```")).toEqual({ topics: [], warning: "nothing_read" });
    expect(parseVisionTopics("---\n42\n!!").warning).toBe("nothing_read");
  });

  /* The bug this whole reasoning path exists for. Groq's `reasoning_format` defaults to `raw`, so a
     reasoning model narrates the job in `message.content` first -- and because the narration quotes
     the requested shape, the old first-`{`-to-last-`}` slice spanned the quote and the answer, failed
     to parse, and sent the deliberation to the line reader: 79 "topics" reading "The user wants me to
     transcribe the table of contents" and chapters reading "Final JSON structure". */
  it("ignores a reasoning block and the shape quoted inside it", () => {
    const chatty = [
      "<think>",
      "The user wants me to transcribe the table of contents from the provided image.",
      "1. Analyze the image:**",
      'The user requested JSON format: `{"topics":[{"title":"...","chapter":"..."}]}`.',
      "I need to drop page numbers and numbering.",
      "Final JSON structure:",
      "</think>",
      '{"topics": [{"title": "Introduction", "chapter": "Section I: Forensic Medicine"},',
      '{"title": "Legal Procedure", "chapter": "Section I: Forensic Medicine"}]}',
    ].join("\n");
    const { topics, warning } = parseVisionTopics(chatty);
    expect(warning).toBe(null);
    expect(topics).toEqual([
      { title: "Introduction", chapter: "Section I: Forensic Medicine", weight: "NORMAL", confidence: "OK" },
      { title: "Legal Procedure", chapter: "Section I: Forensic Medicine", weight: "NORMAL", confidence: "OK" },
    ]);
  });

  /* Thinking that never closed is thinking that ran out of tokens, and every line of it is about the
     job rather than the syllabus. An honest failure sends the student back with a second press. */
  it("refuses to read an unfinished thought as a syllabus", () => {
    const cut = ["<think>", "The image shows a CONTENTS page.", "Below that, a numbered list."].join("\n");
    expect(parseVisionTopics(cut)).toEqual({ topics: [], warning: "nothing_read" });
  });

  /* An index cut off mid-array still names real topics; typing them again by hand is the alternative.
     The "truncated" warning is the one the scanner already reads as "long page, we stopped". */
  it("salvages the topics of a reply whose JSON never closed", () => {
    const clipped =
      '{"topics": [{"title": "Heart failure", "chapter": "Cardiology"}, {"title": "Arrhythmias", "chapter": null}, {"title": "Val';
    const { topics, warning } = parseVisionTopics(clipped);
    expect(warning).toBe("truncated");
    expect(topics).toEqual([
      { title: "Heart failure", chapter: "Cardiology", weight: "NORMAL", confidence: "OK" },
      { title: "Arrhythmias", chapter: null, weight: "NORMAL", confidence: "OK" },
    ]);
  });

  /* "No topic list here" is an answer. Read as text, the reply itself became the topic. */
  it("takes an empty topic list at its word", () => {
    expect(parseVisionTopics('{"topics":[]}')).toEqual({ topics: [], warning: "nothing_read" });
  });
});

describe("proposalShapeError", () => {
  const item = (plannedDate: string, estimatedMinutes: number, kind: ExamItemKind) => ({
    plannedDate,
    estimatedMinutes,
    kind,
  });

  it("insists dedicated question days are actually days with nothing else on them", () => {
    const mixed = [item("2026-08-20", 90, "STUDY"), item("2026-08-20", 45, "QUESTIONS")];
    expect(proposalShapeError(mixed, "DEDICATED_DAYS", 180)).toBe("missing_question_day");
    expect(
      proposalShapeError([...mixed, item("2026-08-21", 90, "QUESTIONS")], "DEDICATED_DAYS", 180),
    ).toBe(null);
  });

  it("insists an integrated plan practises at all", () => {
    const study = [item("2026-08-20", 90, "STUDY"), item("2026-08-21", 60, "REVIEW")];
    expect(proposalShapeError(study, "INTEGRATED", 180)).toBe("missing_question_items");
    expect(proposalShapeError([...study, item("2026-08-21", 30, "QUESTIONS")], "INTEGRATED", 180)).toBe(
      null,
    );
  });

  /* An hour of grace, once per day: rejecting an otherwise fine proposal because one day runs eleven
     minutes over would throw the whole plan away, and any day can still be edited down. */
  it("gives a day an hour of grace over the capacity and no more", () => {
    const load = (minutes: number) => [
      item("2026-08-20", 120, "STUDY"),
      item("2026-08-20", minutes, "QUESTIONS"),
    ];
    expect(proposalShapeError(load(120), "INTEGRATED", 180)).toBe(null);
    expect(proposalShapeError(load(121), "INTEGRATED", 180)).toBe("daily_load_too_high");
    // The load is checked first, so an overloaded day is reported even when the rhythm is wrong too.
    expect(proposalShapeError([item("2026-08-20", 400, "STUDY")], "DEDICATED_DAYS", 180)).toBe(
      "daily_load_too_high",
    );
  });
});

describe("plan window and forum period", () => {
  it("starts the plan at most one board-length before the exam", () => {
    expect(planWindow("2026-08-19", "2026-08-25")).toEqual({
      planFrom: "2026-08-19",
      planTo: "2026-08-25",
    });
    const far = planWindow("2026-08-19", "2026-12-31");
    expect(far).toEqual({ planFrom: "2026-11-02", planTo: "2026-12-31" });
    expect(dayKeySpan(far.planFrom, far.planTo)).toBe(MAX_PLAN_DAYS);
  });

  /* The model is told the dates, not the weekday: "put nothing on 2026-08-21, 2026-08-28" is obeyed
     far more reliably than "skip Fridays". */
  it("turns rest weekdays into the dates inside the window", () => {
    expect(restDatesInWindow("2026-08-19", "2026-08-31", [])).toEqual([]);
    expect(restDatesInWindow("2026-08-19", "2026-08-31", [5])).toEqual([
      "2026-08-21",
      "2026-08-28",
    ]);
    expect(restDatesInWindow("2026-08-19", "2026-08-31", [5, 6])).toEqual([
      "2026-08-21",
      "2026-08-22",
      "2026-08-28",
      "2026-08-29",
    ]);
  });

  it("runs the forum period from the first item to the exam day", () => {
    const { period, error } = forumPeriodForItems(
      ["2026-08-25", "2026-08-20", "2026-08-22"],
      "2026-08-30",
    );
    expect(error).toBe(null);
    expect(period).toEqual({ startDate: "2026-08-20", endDate: "2026-08-30" });
  });

  /* A one-day plan is legal, and an item dragged onto or past the exam day must stay inside the
     period -- an item outside its own plan's period would simply never render on the board. */
  it("holds a single-day plan and an item edited past the exam", () => {
    expect(forumPeriodForItems(["2026-08-20"], "2026-08-20").period).toEqual({
      startDate: "2026-08-20",
      endDate: "2026-08-20",
    });
    expect(forumPeriodForItems(["2026-08-20", "2026-09-02"], "2026-08-30").period).toEqual({
      startDate: "2026-08-20",
      endDate: "2026-09-02",
    });
  });

  it("refuses an empty plan and a period the board could not draw", () => {
    expect(forumPeriodForItems([], "2026-08-30").error).toBe("no_items");
    const start = "2026-08-19";
    expect(forumPeriodForItems([start], addDayKey(start, MAX_PLAN_DAYS - 1)).error).toBe(null);
    expect(forumPeriodForItems([start], addDayKey(start, MAX_PLAN_DAYS)).error).toBe(
      "period_too_long",
    );
  });

  it("writes a day's load the way the note shows it", () => {
    expect(formatLoad(45)).toBe("45m");
    expect(formatLoad(180)).toBe("3h");
    expect(formatLoad(195)).toBe("3h 15m");
    expect(formatLoad(195, true)).toBe("3 س 15 د");
  });
});
