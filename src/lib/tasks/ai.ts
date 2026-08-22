import { z } from "zod";
import { GROQ_MODEL, groq } from "@/lib/ai/groq";
import { hashAIInput, makeAIJobKey } from "@/lib/ai/policy";
import { runTrackedAIJob } from "@/lib/ai/jobs";
import { prisma } from "@/lib/db/prisma";
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

/**
 * Parse free text into a pending TaskDraft, under the same governance as every other AI
 * surface (audit M10/L2: this used to call Groq directly -- invisible to daily job
 * ceilings and dashboards, and two identical concurrent requests each paid for their own
 * call).
 *
 * The Groq call, draft creation, and usage logging all happen inside the tracked job's
 * run() so a lost atomic claim wastes nothing. Identical input inside one 15-minute
 * bucket resolves to the earlier PENDING draft instead of a second spend -- mirroring the
 * reuse window the rest of the AI layer documents.
 */
export async function parseTaskText(
  userId: string,
  text: string,
  locale: "en" | "ar",
  now = new Date(),
) {
  /* Local binding so the null-check narrows inside the run() closure too. */
  const client = groq;
  if (!client) return { available: false as const };
  const result = await runTrackedAIJob({
    userId,
    type: "TASK_PARSE",
    operation: "task_parse",
    jobKey: makeAIJobKey("TASK_PARSE", {
      text,
      locale,
      /* Time-bucketed so the completed-job cache cannot pin one input forever: a new
         bucket means the student may legitimately ask again. */
      bucket: Math.floor(now.getTime() / (15 * 60_000)),
    }),
    inputHash: hashAIInput({ text, locale }),
    metadata: { locale },
    run: async ({ recordUsage }) => {
      const completion = await client.chat.completions.create({
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
      let parsedDraft: z.infer<typeof parsedTaskDraftSchema>;
      try {
        parsedDraft = parsedTaskDraftSchema.parse(JSON.parse(content));
      } catch {
        /* Malformed model JSON used to escape as a raw SyntaxError -> unexplained 500;
           it belongs to the retryable taxonomy every other AI caller uses (audit L9). */
        throw new Error("invalid_ai_response");
      }
      await recordUsage(completion.usage);
      const normalizedSubjectName = parsedDraft.subjectName
        ?.toLocaleLowerCase()
        .replace(/\s+/g, " ");
      const subject = normalizedSubjectName
        ? await prisma.subject.findFirst({
            where: { userId, archivedAt: null, normalizedName: normalizedSubjectName },
          })
        : null;
      return prisma.taskDraft.create({
        data: {
          userId,
          sourceText: text,
          title: parsedDraft.title,
          notes: parsedDraft.notes,
          subjectId: subject?.id,
          subjectName: parsedDraft.subjectName,
          priority: parsedDraft.priority,
          dueAt: parsedDraft.dueAt ? new Date(parsedDraft.dueAt) : null,
          estimatedMinutes: parsedDraft.estimatedMinutes,
          recurrenceRule: parsedDraft.recurrenceRule ?? undefined,
          model: GROQ_MODEL,
          expiresAt: new Date(now.getTime() + 30 * 86400000),
        },
      });
    },
  });

  if (!result.ok) return { available: false as const, error: result.error, status: result.status };

  /* Cache hit: the exact input already produced a draft this bucket. Hand back the most
     recent still-pending copy rather than charging Groq again; if the student already
     decided it, report unavailable rather than silently re-parsing. */
  if (result.cached) {
    const reused = await prisma.taskDraft.findFirst({
      where: {
        userId,
        sourceText: text,
        status: "PENDING",
        createdAt: { gte: new Date(now.getTime() - 16 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!reused) return { available: false as const, error: "ai_unavailable", status: 503 };
    return { available: true as const, draft: reused };
  }

  return { available: true as const, draft: result.value };
}
