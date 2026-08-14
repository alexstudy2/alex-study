import { challengeStats } from "@/lib/challenges/service";
import { apiUser, unauthorized } from "@/lib/tasks/response";
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  return Response.json(await challengeStats(user.id));
}
