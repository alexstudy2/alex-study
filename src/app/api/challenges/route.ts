import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { challengeInputSchema } from "@/lib/challenges/validation";
import { challengeInclude } from "@/lib/challenges/queries";
import { createChallenge } from "@/lib/challenges/service";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";
import { enforceRateLimit, inviteRateLimit } from "@/lib/http/rate-limit";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  await recalculateChallengesForUser(user.id);
  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ creatorId: user.id }, { opponentId: user.id }] },
    include: challengeInclude,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ challenges });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limited = await enforceRateLimit(request, inviteRateLimit, user.id);
  if (limited) return limited;
  const parsed = challengeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const result = await createChallenge(user, parsed.data);
  if ("error" in result) return invalid({ challenge: [result.error] });
  return Response.json(result, { status: 201 });
}
