import { generateExamPlan } from "@/lib/exam-plans/service";
import { examPlanGenerateSchema } from "@/lib/exam-plans/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { enforceRateLimit, generationRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, generationRateLimit, user.id);
  if (limited) return limited;
  const parsed = examPlanGenerateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const result = await generateExamPlan(user.id, user.locale === "AR" ? "ar" : "en", parsed.data);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(
    { plan: result.plan, cached: result.cached },
    { status: result.cached ? 200 : 201 },
  );
}
