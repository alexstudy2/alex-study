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
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!reset || reset.usedAt || reset.expiresAt < new Date())
    return Response.json({ error: "expired_or_invalid_token" }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hash(parsed.data.password, 12) },
    }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
  return Response.json({ ok: true });
}
