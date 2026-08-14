import Link from "next/link";
import { getLocale } from "next-intl/server";
import { SignInForm } from "@/components/auth/auth-forms";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [requested, query] = await Promise.all([getLocale(), searchParams]);
  const locale = requested === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  const notice = query.registered
    ? ar
      ? "تم إنشاء الحساب. يمكنك تسجيل الدخول الآن."
      : "Account created. You can sign in now."
    : query.reset
      ? ar
        ? "تم تحديث كلمة المرور."
        : "Password updated."
      : query.deleted
        ? ar
          ? "تم حذف الحساب."
          : "Your account was deleted."
        : "";
  return (
    <div className="auth-content">
      <p className="eyebrow">{ar ? "مرحبا بعودتك" : "Welcome back"}</p>
      <h2>{ar ? "واصل إيقاع دراستك" : "Continue your study rhythm"}</h2>
      {notice && (
        <p className="form-feedback" role="status">
          {notice}
        </p>
      )}
      <SignInForm locale={locale} />
      <div className="auth-links">
        <Link href="/forgot-password">{ar ? "نسيت كلمة المرور؟" : "Forgot password?"}</Link>
        <Link href="/sign-up">{ar ? "إنشاء حساب" : "Create an account"}</Link>
      </div>
    </div>
  );
}
