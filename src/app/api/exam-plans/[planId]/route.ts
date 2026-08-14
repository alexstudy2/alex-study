import { examPlanErrorResponse } from "@/lib/exam-plans/response";
import { getExamPlan, updateExamPlan } from "@/lib/exam-plans/service";
import { examPlanPatchSchema } from "@/lib/exam-plans/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function GET(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  const plan = await getExamPlan(user.id, planId);
  return plan ? Response.json({ plan }) : notFound();
}

export async function PATCH(request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = examPlanPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId } = await context.params;
  try {
    return Response.json({ plan: await updateExamPlan(user.id, planId, parsed.data) });
  } catch (reason) {
    return examPlanErrorResponse(reason);
  }
}
