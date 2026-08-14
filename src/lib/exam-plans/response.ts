import { ExamPlanError } from "./service";

export function examPlanErrorResponse(reason: unknown) {
  if (reason instanceof ExamPlanError)
    return Response.json(
      { error: reason.message, fields: reason.fields },
      { status: reason.status },
    );
  return Response.json({ error: "server_error" }, { status: 500 });
}
