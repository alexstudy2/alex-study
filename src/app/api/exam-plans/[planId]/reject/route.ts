import { examPlanErrorResponse } from "@/lib/exam-plans/response";
import { rejectExamPlan } from "@/lib/exam-plans/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";

export async function POST(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  try {
    return Response.json({ plan: await rejectExamPlan(user.id, planId) });
  } catch (reason) {
    return examPlanErrorResponse(reason);
  }
}
