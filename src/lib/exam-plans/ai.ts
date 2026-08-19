import "server-only";

import type { AIUsage } from "@/lib/ai/jobs";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import { planWindow, restDatesInWindow } from "./days";
import { proposalShapeError, type ExamStudyMode, type QuestionStrategy } from "./topics";
import {
  MAX_PLAN_ITEMS,
  cairoDateKey,
  generatedExamPlanSchema,
  proposalDatesAreValid,
} from "./validation";

/**
 * The two rhythms a student can pick between, written for the model rather than for the UI. The
 * wording matters: "no new material" and "cover exactly what that day studied" are the two claims
 * `proposalShapeError` then checks, so the instruction and the validation say the same thing.
 */
const STRATEGY_RULE: Record<QuestionStrategy, string> = {
  DEDICATED_DAYS:
    'Reserve whole days for question practice. On such a day every item has kind "QUESTIONS" and no new material appears; place one after each block of related topics, and at least one in the plan.',
  INTEGRATED:
    'End every study day with one item of kind "QUESTIONS" whose title names the questions to solve on exactly what that day studied. Never give a day only questions.',
};

/**
 * What the plan is made of, which is a bigger difference than the rhythm above: these rules decide
 * whether a topic is met once, twice, or as revision of something already learned.
 *
 * Each rule names the kind it forbids in the same words `proposalShapeError` rejects it in. A model
 * asked for revision that quietly opens with a week of first-pass teaching has not written a slightly
 * imperfect plan -- it has written the plan for a different student -- so the instruction is blunt.
 */
const MODE_RULE: Record<ExamStudyMode, string> = {
  STUDY_AND_REVIEW:
    'Learn then revise: every topic gets an item of kind "STUDY" for its first pass, and the plan then returns to the same topics with items of kind "REVIEW" -- a heavy or weak topic earns its own revision item, steadier topics can be revised in grouped blocks. Keep the last day or two before the exam for "REVIEW" and "QUESTIONS" only, and include at least one "REVIEW" item.',
  STUDY_ONLY:
    'First pass only: this student revises in their own way and asked for the studying alone. Every item that covers material has kind "STUDY", and the kind "REVIEW" must not appear anywhere in the plan -- no revision blocks, no revision days, no "quick recap" items. Spend the time that revision would have taken on the material itself, giving the heavy and weak topics more of it, and make the last day before the exam the lightest study day rather than a revision day.',
  REVIEW_ONLY:
    'Revision only: this student has already studied the material. Every item that covers material has kind "REVIEW", and the kind "STUDY" must not appear anywhere in the plan -- nothing is being met for the first time. Take every topic in one full pass, weak and heavy topics first while there is most room, then use whatever days remain for a second shorter pass over those same weak and heavy topics, and leave the day before the exam as a light pass over everything. Revision items are shorter than study blocks, so expect more of them in a day.',
};

export async function generateExamPlanProposal(
  input: {
    title: string;
    examAt: Date;
    syllabusText: string;
    questionStrategy: QuestionStrategy;
    studyMode: ExamStudyMode;
    dailyCapacityMinutes: number;
    restDays: number[];
    locale: "en" | "ar";
    subjects: Array<{ name: string }>;
    now: Date;
  },
  recordUsage: (usage?: AIUsage) => Promise<void>,
) {
  if (!groq) throw new Error("ai_unavailable");
  const examDate = cairoDateKey(input.examAt);
  const currentDate = cairoDateKey(input.now);
  const { planFrom } = planWindow(currentDate, examDate);
  const restDates = restDatesInWindow(planFrom, examDate, input.restDays);

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.15,
    max_completion_tokens: 6_000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          `Create an editable exam-study proposal in ${input.locale}. Return strict JSON with overview and items.`,
          `Each item must contain title, notes or null, subjectName or null, plannedDate as YYYY-MM-DD, estimatedMinutes, and kind, one of "STUDY", "QUESTIONS" or "REVIEW".`,
          `The syllabus is a list of topics. A "## " line is a chapter heading. A topic may be annotated "(heavy)", "(light)", "(weak)" or "(strong)": heavy topics need more minutes or more than one block and light topics fewer; a weak topic needs more time and an extra pass, a strong one needs only a short refresher.`,
          `Cover every supplied topic at least once and never invent a topic that is not listed.`,
          `Plan shape: ${MODE_RULE[input.studyMode]}`,
          `Question strategy: ${STRATEGY_RULE[input.questionStrategy]}`,
          `Schedule only between ${planFrom} and ${examDate} in Africa/Cairo.`,
          restDates.length
            ? `Leave these rest days completely empty: ${restDates.join(", ")}.`
            : `The student takes no fixed rest day.`,
          `Never put more than ${input.dailyCapacityMinutes} minutes on one date; that figure is the student's whole study day, not a target to exceed.`,
          `Use 15-360 minutes per item, at most 4 items on one date, and at most ${MAX_PLAN_ITEMS} items in total; if the syllabus is larger than that, group related topics into one block rather than dropping any.`,
          `Say in the overview how the plan is shaped and where it starts.`,
          `Use only the supplied owned subject names, or null.`,
          `This is a proposal only: never claim tasks were created, never use competitive data, never diagnose or shame, and never invent syllabus topics.`,
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          examDate,
          currentDate,
          planFrom,
          studyMode: input.studyMode,
          questionStrategy: input.questionStrategy,
          dailyCapacityMinutes: input.dailyCapacityMinutes,
          restDates,
          syllabusText: input.syllabusText,
          ownedSubjects: input.subjects.map((subject) => subject.name),
        }),
      },
    ],
  });
  await recordUsage(completion.usage);

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("empty_ai_response");

  /*
   * Three failures used to collapse into one `invalid_ai_response`, which made a reply that never
   * parsed indistinguishable in the job log from a perfectly good JSON plan that overloaded a
   * Tuesday. Unreadable output stays `invalid_ai_response`; output that parsed but broke the brief is
   * `invalid_ai_plan`. Both are retryable, so a bad first draft still becomes a good second one.
   */
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    throw new Error("invalid_ai_response");
  }
  const parsed = generatedExamPlanSchema.safeParse(payload);
  if (!parsed.success) throw new Error("invalid_ai_response");

  if (!proposalDatesAreValid(parsed.data.items, input.examAt, input.now))
    throw new Error("invalid_ai_plan");
  if (
    proposalShapeError(parsed.data.items, {
      questionStrategy: input.questionStrategy,
      studyMode: input.studyMode,
      dailyCapacityMinutes: input.dailyCapacityMinutes,
    })
  )
    throw new Error("invalid_ai_plan");
  return parsed.data;
}
