import { getLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/recovery-forms";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [{ token }, requested] = await Promise.all([params, getLocale()]);
  const locale = requested === "ar" ? "ar" : "en";
  return (
    <div className="auth-content">
      <p className="eyebrow">{locale === "ar" ? "كلمة مرور جديدة" : "Choose a new password"}</p>
      <h2>{locale === "ar" ? "أمّن حسابك" : "Secure your account"}</h2>
      <ResetPasswordForm token={token} locale={locale} />
    </div>
  );
}
