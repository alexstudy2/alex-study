import { prisma } from "@/lib/db/prisma";
import { isChallengeParticipant } from "@/lib/challenges/queries";
import { newShareToken } from "@/lib/challenges/service";
import { shareSettingsSchema } from "@/lib/challenges/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  request: Request,
  context: { params: Promise<{ challengeId: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { challengeId } = await context.params;
  const parsed = shareSettingsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return invalid();
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !isChallengeParticipant(challenge, user.id)) return notFound();
  if (
    parsed.data.enabled &&
    (!challenge.acceptedAt || !["COMPLETED", "EXPIRED"].includes(challenge.status))
  )
    return invalid({ challenge: ["result_not_shareable"] });
  const updated = await prisma.challenge.update({
    where: { id: challenge.id },
    data: { shareToken: newShareToken(), shareEnabled: parsed.data.enabled },
    select: { shareToken: true, shareEnabled: true },
  });
  return Response.json({ ...updated, url: `/share/challenges/${updated.shareToken}` });
}
