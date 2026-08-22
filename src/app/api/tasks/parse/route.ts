import { parseTaskText } from "@/lib/tasks/ai";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { parseTaskSchema } from "@/lib/tasks/validation";
import { enforceRateLimit, generationRateLimit } from "@/lib/http/rate-limit";

/* The Groq call, usage logging, and daily governance now live inside runTrackedAIJob
   (src/lib/tasks/ai.ts) -- this route is a thin shell over it. */
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, generationRateLimit, user.id);
  if (limited) return limited;
  const parsed = parseTaskSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const result = await parseTaskText(user.id, parsed.data.text, parsed.data.locale);
  if (!result.available)
    return Response.json(
      { error: result.error ?? "ai_unavailable" },
      { status: result.status ?? 503 },
    );
  return Response.json({ draft: result.draft }, { status: 201 });
}
