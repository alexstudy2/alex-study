import { hash } from "bcryptjs";
import { z } from "zod";
import { hashResetToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { readRequestBody } from "@/lib/http/body";
import { enforceRateLimit, recoveryRateLimit } from "@/lib/http/rate-limit";

const schema = z.object({ token: z.string().min(32), password: z.string().min(8).max(128) });
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, recoveryRateLimit);
  if (limited) return limited;
  const parsed = schema.safeParse(await readRequestBody(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const tokenHash = hashResetToken(parsed.data.token);
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date())
    return Response.json({ error: "expired_or_invalid_token" }, { status: 400 });
  /* Consume the token with a conditional write instead of the old read-check-write:
     two concurrent submissions must yield exactly one success, and the loser gets the
     same generic response as an expired link (audit H3). The same transaction bumps
     sessionVersion -- killing every outstanding session cookie -- and deletes all of
     the user's other tokens so nothing else can redeem afterwards (audit H4/T1.4). */
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0)
    return Response.json({ error: "expired_or_invalid_token" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: {
        passwordHash: await hash(parsed.data.password, 12),
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: reset.userId, id: { not: reset.id } },
    }),
  ]);
  return Response.json({ ok: true });
}
