import nodemailer from "nodemailer";

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) return { delivered: false, reason: "smtp_not_configured" } as const;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: `Alex Study <${user}>`,
    to,
    subject: "Reset your Alex Study password",
    text: `Open this link within one hour to reset your password: ${resetUrl}`,
  });
  return { delivered: true } as const;
}

export async function sendNotificationEmail(
  to: string,
  subject: string,
  body: string,
  actionUrl?: string,
) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_APP_PASSWORD;
  if (!user || !pass) return { delivered: false, reason: "smtp_not_configured" } as const;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
  });
  const link = actionUrl
    ? `\n\nOpen Alex Study: ${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${actionUrl}`
    : "";
  await transport.sendMail({ from: `Alex Study <${user}>`, to, subject, text: `${body}${link}` });
  return { delivered: true } as const;
}
