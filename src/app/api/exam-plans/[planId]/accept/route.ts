import { examPlanErrorResponse } from "@/lib/exam-plans/response";
import { acceptExamPlanItems } from "@/lib/exam-plans/service";
import { acceptExamPlanSchema } from "@/lib/exam-plans/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function POST(request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = acceptExamPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId } = await context.params;
  try {
    return Response.json(await acceptExamPlanItems(user.id, planId, parsed.data.itemIds), {
      status: 201,
    });
  } catch (reason) {
    return examPlanErrorResponse(reason);
  }
}
