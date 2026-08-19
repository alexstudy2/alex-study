import { publishExamPlanToForum } from "@/lib/exam-plans/publish";
import { examPlanErrorResponse } from "@/lib/exam-plans/response";
import { apiUser, unauthorized } from "@/lib/tasks/response";

/**
 * Publishes a proposal to the Plan Forum, or updates the copy already there. No body: everything it
 * needs is the plan itself, and "publish this" has no options to get wrong.
 */
export async function POST(_request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  try {
    const result = await publishExamPlanToForum(user.id, planId);
    return Response.json(result, { status: result.republished ? 200 : 201 });
  } catch (reason) {
    return examPlanErrorResponse(reason);
  }
}
