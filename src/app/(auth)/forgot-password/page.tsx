import { getLocale } from "next-intl/server";
import { ForgotPasswordForm, ManualResetLink } from "@/components/auth/recovery-forms";

export default async function ForgotPasswordPage() {
  const locale = (await getLocale()) === "ar" ? "ar" : "en";
  return (
    <div className="auth-content">
      <p className="eyebrow">{locale === "ar" ? "استعادة الحساب" : "Account recovery"}</p>
      <h2>{locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset your password"}</h2>
      <ForgotPasswordForm locale={locale} />
      <ManualResetLink locale={locale} />
    </div>
  );
}
