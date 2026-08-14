import { forgotPasswordSchema } from "@/lib/auth/validation";
import { createResetToken, hashResetToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { readRequestBody } from "@/lib/http/body";
import { enforceRateLimit, recoveryRateLimit } from "@/lib/http/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, recoveryRateLimit);
  if (limited) return limited;
  const parsed = forgotPasswordSchema.safeParse(await readRequestBody(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const user = await prisma.user.findFirst({
    where: { collegeId: parsed.data.collegeId.toUpperCase() },
  });
  if (!user) return Response.json({ ok: true });
  if (!user.email) return Response.json({ ok: true });
  const token = createResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const origin = new URL(request.url).origin;
  await sendPasswordResetEmail(user.email, `${origin}/reset-password/${token}`);
  return Response.json({ ok: true });
}
