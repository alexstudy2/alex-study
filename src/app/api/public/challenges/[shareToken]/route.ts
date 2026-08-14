import { publicChallengeByToken } from "@/lib/challenges/service";
import { notFound } from "@/lib/tasks/response";
export async function GET(_request: Request, context: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await context.params;
  const challenge = await publicChallengeByToken(shareToken);
  return challenge ? Response.json({ challenge }) : notFound();
}
