export { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export function conflict(message = "conflict") {
  return Response.json({ error: message }, { status: 409 });
}
