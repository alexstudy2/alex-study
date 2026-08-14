import { z } from "zod";
import type { AIUsage } from "@/lib/ai/jobs";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import type { InsightSignal } from "./signals";

export const generatedInsightSchema = z.object({
  type: z.enum(["DAILY_TIP", "WEEKLY_RECAP", "PERFORMANCE_DROP", "BURNOUT", "BEST_TIME"]),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(1000),
});

const generatedInsightCopySchema = generatedInsightSchema.omit({ type: true });

export async function generateInsight(
  signal: InsightSignal,
  locale: "en" | "ar",
  recordUsage: (usage?: AIUsage) => Promise<void>,
) {
  if (!groq) throw new Error("ai_unavailable");
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    max_completion_tokens: 450,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Write one concise, supportive study insight in ${locale}. A deterministic detector already selected ${signal.type}; you only explain the supplied aggregate personal facts. Return strict JSON with title and content. Do not diagnose, shame, compare with other people, mention rankings or challenges, invent causes, or state certainty. For BURNOUT, call it a workload check-in and explicitly avoid medical claims. For BEST_TIME, describe an observed pattern rather than a prescription.`,
      },
      { role: "user", content: JSON.stringify(signal) },
    ],
  });
  await recordUsage(completion.usage);
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("empty_ai_response");
  try {
    const copy = generatedInsightCopySchema.parse(JSON.parse(content));
    return generatedInsightSchema.parse({ type: signal.type, ...copy });
  } catch {
    throw new Error("invalid_ai_response");
  }
}
