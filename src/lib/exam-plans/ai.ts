import "server-only";

import type { AIUsage } from "@/lib/ai/jobs";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import { planWindow, restDatesInWindow } from "./days";
import { proposalShapeError, type QuestionStrategy } from "./topics";
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

export async function generateExamPlanProposal(
  input: {
    title: string;
    examAt: Date;
    syllabusText: string;
    questionStrategy: QuestionStrategy;
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
          `The syllabus is a list of topics. A "## " line is a chapter heading. A topic may be annotated "(heavy)", "(light)", "(weak)" or "(strong)": heavy topics need more minutes or more than one block and light topics fewer; a weak topic needs more time and an extra REVIEW pass, a strong one needs only a short refresher.`,
          `Cover every supplied topic at least once and never invent a topic that is not listed.`,
          `Question strategy: ${STRATEGY_RULE[input.questionStrategy]}`,
          `Schedule only between ${planFrom} and ${examDate} in Africa/Cairo.`,
          restDates.length
            ? `Leave these rest days completely empty: ${restDates.join(", ")}.`
            : `The student takes no fixed rest day.`,
          `Never put more than ${input.dailyCapacityMinutes} minutes on one date; that figure is the student's whole study day, not a target to exceed.`,
          `Use 15-360 minutes per item, at most 4 items on one date, and at most ${MAX_PLAN_ITEMS} items in total; if the syllabus is larger than that, group related topics into one block rather than dropping any.`,
          `Keep the last day or two before the exam for REVIEW and QUESTIONS only, and say in the overview how the plan is shaped and where it starts.`,
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
    proposalShapeError(parsed.data.items, input.questionStrategy, input.dailyCapacityMinutes)
  )
    throw new Error("invalid_ai_plan");
  return parsed.data;
}
