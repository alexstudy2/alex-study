import { randomUUID } from "node:crypto";
import { GROQ_VISION_MODEL } from "@/lib/ai/groq";
import { hashAIInput, makeAIJobKey, runTrackedAIJob } from "@/lib/ai/jobs";
import { extractSyllabusTopics } from "@/lib/exam-plans/vision";
import { extractTopicsSchema } from "@/lib/exam-plans/validation";
import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, generationRateLimit } from "@/lib/http/rate-limit";

/**
 * Reads a photographed syllabus index into topic rows for the composer.
 *
 * One image per request, and the image is never stored: it goes from this body straight to Groq and
 * is dropped. Only the transcribed topics reach the database, and only once the student presses
 * Generate -- inside `ExamPlan.syllabusText`, under the same 30-day purge as every other AI context.
 */
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, generationRateLimit, user.id);
  if (limited) return limited;

  const parsed = extractTopicsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { aiNudgesEnabled: true },
  });
  if (!profile?.aiNudgesEnabled) return Response.json({ error: "ai_disabled" }, { status: 403 });

  const inputHash = hashAIInput({ image: parsed.data.image.length, model: GROQ_VISION_MODEL });
  const tracked = await runTrackedAIJob({
    userId: user.id,
    type: "EXAM_TOPICS",
    operation: "exam_plan_extract_topics",
    model: GROQ_VISION_MODEL,
    inputHash,
    /*
     * A nonce, deliberately. Every other AI job dedupes on its input so a double press returns the
     * first answer -- but nothing persists an OCR result, so a `cached: true` hit here would have
     * nothing to hand back. Photographing a second page is also a new request by definition, even
     * when the two images happen to hash alike.
     */
    jobKey: makeAIJobKey("EXAM_TOPICS", { userId: user.id, nonce: randomUUID() }),
    metadata: { imageCharacters: parsed.data.image.length },
    run: ({ recordUsage }) =>
      extractSyllabusTopics(
        { image: parsed.data.image, locale: user.locale === "AR" ? "ar" : "en" },
        recordUsage,
      ),
  });
  if (!tracked.ok) return Response.json({ error: tracked.error }, { status: tracked.status });
  if (tracked.cached) return Response.json({ topics: [], warning: "nothing_read" });
  return Response.json(tracked.value);
}
