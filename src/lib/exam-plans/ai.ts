import "server-only";

import type { AIUsage } from "@/lib/ai/jobs";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import { cairoDateKey, generatedExamPlanSchema, proposalDatesAreValid } from "./validation";

export async function generateExamPlanProposal(
  input: {
    title: string;
    examAt: Date;
    syllabusText: string;
    locale: "en" | "ar";
    subjects: Array<{ name: string }>;
    now: Date;
  },
  recordUsage: (usage?: AIUsage) => Promise<void>,
) {
  if (!groq) throw new Error("ai_unavailable");
  const examDate = cairoDateKey(input.examAt);
  const currentDate = cairoDateKey(input.now);
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.15,
    max_completion_tokens: 3_000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Create an editable exam-study proposal in ${input.locale}. Return strict JSON with overview and items. Each item must contain title, notes or null, subjectName or null, plannedDate as YYYY-MM-DD, and estimatedMinutes. Use only the supplied syllabus and owned subject names. Dates must be between ${currentDate} and ${examDate} in Africa/Cairo. Use 15-360 minutes per item, no more than 480 total minutes on one date, at most 60 items, and leave reasonable review buffer before the exam. This is a proposal only: never claim tasks were created, never use competitive data, never diagnose or shame, and never invent syllabus topics.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          examDate,
          syllabusText: input.syllabusText,
          ownedSubjects: input.subjects.map((subject) => subject.name),
        }),
      },
    ],
  });
  await recordUsage(completion.usage);
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("empty_ai_response");
  try {
    const proposal = generatedExamPlanSchema.parse(JSON.parse(content));
    if (!proposalDatesAreValid(proposal.items, input.examAt, input.now))
      throw new Error("invalid_dates");
    const perDay = new Map<string, number>();
    for (const item of proposal.items)
      perDay.set(item.plannedDate, (perDay.get(item.plannedDate) ?? 0) + item.estimatedMinutes);
    if ([...perDay.values()].some((minutes) => minutes > 480))
      throw new Error("daily_load_too_high");
    return proposal;
  } catch {
    throw new Error("invalid_ai_response");
  }
}
