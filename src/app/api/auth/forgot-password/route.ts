import { forgotPasswordSchema } from "@/lib/auth/validation";
import { createResetToken, hashResetToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db/prisma";
import { sendPasswordResetEmail } from "@/lib/email/mailer";
import { readRequestBody } from "@/lib/http/body";
import { enforceRateLimit, recoveryMissDelay, recoveryRateLimit } from "@/lib/http/rate-limit";
import { siteOrigin } from "@/lib/http/base-url";
import { captureError } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, recoveryRateLimit);
  if (limited) return limited;
  const parsed = forgotPasswordSchema.safeParse(await readRequestBody(request).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });
  const user = await prisma.user.findFirst({
    where: { collegeId: parsed.data.collegeId.toUpperCase() },
  });
  if (!user) {
    await recoveryMissDelay();
    return Response.json({ ok: true });
  }
  if (!user.email) {
    await recoveryMissDelay();
    return Response.json({ ok: true });
  }
  const token = createResetToken();
  /* Expire the user's other unredeemed tokens in the same write: without this, every
     request stacks another live link and anyone holding an older token can still redeem
     after the password is rotated (audit H3). */
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { expiresAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    }),
  ]);
  /* The link's origin must come from configuration, not the request (audit M4): behind a
     proxy that forwards attacker-chosen Host headers, a request-derived origin turns the
     emailed link into `https://attacker.example/reset-password/<valid-token>`. The
     env-chain in siteOrigin() (APP_URL -> NEXTAUTH_URL -> Vercel host) is authoritative
     for recovery mail -- notification emails already work exactly this way. */
  const origin = siteOrigin();
  const sent = await sendPasswordResetEmail(user.email, `${origin}/reset-password/${token}`);
  /* The response stays uniformly `ok: true` (no enumeration), but delivery failure is no
     longer silent -- structured logs carry it so a dead SMTP config is discoverable
     instead of leaving recovery broken forever (audit M14). */
  if (!sent.delivered) {
    captureError("auth.forgot-password", new Error(sent.reason ?? "smtp_send_failed"), {
      collegeIdPrefix: user.collegeId.slice(0, 2),
    });
  }
  return Response.json({ ok: true });
}
