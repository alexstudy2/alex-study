import { z } from "zod";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import { recurrenceSchema, taskPrioritySchema } from "./validation";

export const parsedTaskDraftSchema = z.object({
  title: z.string().min(1).max(180),
  notes: z.string().max(5000).nullable().default(null),
  subjectName: z.string().max(80).nullable().default(null),
  priority: taskPrioritySchema.default("MEDIUM"),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  estimatedMinutes: z.number().int().min(5).max(1440).nullable().default(null),
  recurrenceRule: recurrenceSchema.nullable().default(null),
});

export async function parseTaskText(text: string, locale: "en" | "ar", now = new Date()) {
  if (!groq) return { available: false as const };
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0,
    max_completion_tokens: 650,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Extract one study task as strict JSON. Current time: ${now.toISOString()}. Timezone: Africa/Cairo. Week starts Sunday. Language: ${locale}. Fields: title, notes, subjectName, priority LOW|MEDIUM|HIGH|URGENT, dueAt ISO-8601 with offset or null, estimatedMinutes or null, recurrenceRule null or {frequency: DAILY, interval} or {frequency: WEEKLY, interval, weekDays:[0-6]}. Never invent details.`,
      },
      { role: "user", content: text },
    ],
  });
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("empty_ai_response");
  return {
    available: true as const,
    draft: parsedTaskDraftSchema.parse(JSON.parse(content)),
    usage: completion.usage,
  };
}
