import { acceptChallenge } from "@/lib/challenges/service";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const challenge = await acceptChallenge(challengeId, user);
  return challenge ? Response.json({ challenge }) : notFound();
}
