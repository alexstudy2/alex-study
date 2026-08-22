import nodemailer from "nodemailer";
import { siteOrigin } from "@/lib/http/base-url";
import { captureError } from "@/lib/observability/logger";

/**
 * Strip control characters (including CR/LF) from anything user-influenced that reaches
 * a header or body line. Nodemailer already neutralises header newlines, but its major
 * is only loosely pinned against the types package -- belt and suspenders here costs
 * one regex (audit L8/H8).
 */
function sanitize(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

async function deliver(
  scope: string,
  to: string,
  subject: string,
  text: string,
): Promise<{ delivered: boolean; reason?: string }> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) {
    /* Recovery mail silently failing used to be invisible (audit M14): every
       non-delivery now lands in structured logs with a reason code. */
    captureError(scope, new Error("smtp_not_configured"));
    return { delivered: false, reason: "smtp_not_configured" };
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
  });
  try {
    await transport.sendMail({ from: `Alex Study <${user}>`, to, subject, text });
    return { delivered: true };
  } catch (error) {
    captureError(scope, error, { to });
    return { delivered: false, reason: "smtp_send_failed" };
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return deliver(
    "mail.password-reset",
    to,
    "Reset your Alex Study password",
    `Open this link within one hour to reset your password: ${sanitize(resetUrl)}`,
  );
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  body: string,
  actionUrl?: string,
) {
  /* Notification sends also run from cron with no request in scope, so this goes through
     the environment chain -- which deliberately refuses a localhost NEXTAUTH_URL in a
     hosted deployment instead of mailing out links to the recipient's own machine. */
  const link = actionUrl ? `\n\nOpen Alex Study: ${siteOrigin()}${actionUrl}` : "";
  return deliver(
    "mail.notification",
    to,
    sanitize(subject),
    `${sanitize(body)}${link}`,
  );
}
