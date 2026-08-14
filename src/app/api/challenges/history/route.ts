import { challengeHistory } from "@/lib/challenges/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limit = Number(new URL(request.url).searchParams.get("limit")) || 30;
  return Response.json({ challenges: await challengeHistory(user.id, limit) });
}
