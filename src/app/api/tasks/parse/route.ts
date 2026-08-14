import { prisma } from "@/lib/db/prisma";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { parseTaskText } from "@/lib/tasks/ai";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { parseTaskSchema } from "@/lib/tasks/validation";
import { enforceRateLimit, generationRateLimit } from "@/lib/http/rate-limit";
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, generationRateLimit, user.id);
  if (limited) return limited;
  const parsed = parseTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const result = await parseTaskText(parsed.data.text, parsed.data.locale);
  if (!result.available) return Response.json({ error: "ai_unavailable" }, { status: 503 });
  const subject = result.draft.subjectName
    ? await prisma.subject.findFirst({
        where: {
          userId: user.id,
          archivedAt: null,
          normalizedName: result.draft.subjectName.toLocaleLowerCase().replace(/\s+/g, " "),
        },
      })
    : null;
  const draft = await prisma.$transaction(async (tx) => {
    const created = await tx.taskDraft.create({
      data: {
        userId: user.id,
        sourceText: parsed.data.text,
        ...result.draft,
        subjectId: subject?.id,
        dueAt: result.draft.dueAt ? new Date(result.draft.dueAt) : null,
        recurrenceRule: result.draft.recurrenceRule ?? undefined,
        model: GROQ_MODEL,
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await tx.serviceUsageLog.create({
      data: {
        userId: user.id,
        service: "groq",
        operation: "task_parse",
        model: GROQ_MODEL,
        units: result.usage?.total_tokens ?? 1,
        inputUnits: result.usage?.prompt_tokens,
        outputUnits: result.usage?.completion_tokens,
        metadata: { model: GROQ_MODEL, userId: user.id },
      },
    });
    return created;
  });
  return Response.json({ draft }, { status: 201 });
}
