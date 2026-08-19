import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Info, TriangleAlert } from "lucide-react";
import { SignInForm } from "@/components/auth/sign-in-form";

/**
 * Where to land after a successful sign-in.
 *
 * This is the one redirect target in the app that comes from the URL, so it is treated as
 * hostile: only a same-origin path survives. Anything absolute (`https://…`), protocol-
 * relative (`//evil`, and `/\evil`, which several browsers also resolve as a host) or
 * otherwise not a plain path falls back to the dashboard.
 */
function safeCallback(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return "/dashboard";
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [requested, query] = await Promise.all([getLocale(), searchParams]);
  const ar = requested === "ar";
  const locale = ar ? "ar" : "en";

  const notice = query.registered
    ? ar
      ? "تم إنشاء الحساب، وحفظنا كل تفضيلاتك. سجل الدخول للبدء."
      : "Account created, with all your preferences saved. Sign in to begin."
    : query.reset
      ? ar
        ? "تم تحديث كلمة المرور."
        : "Password updated."
      : query.deleted
        ? ar
          ? "تم حذف الحساب."
          : "Your account was deleted."
        : "";

  /* next-auth appends ?error=… when it bounces someone back here (an expired session hitting
     a protected page, a failed non-JS submit). The page used to drop it silently. */
  const failure = query.error
    ? ar
      ? "تعذر تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى."
      : "We could not sign you in. Check your details and try again."
    : "";

  return (
    <div className="auth-content">
      <p className="eyebrow">{ar ? "مرحبا بعودتك" : "Welcome back"}</p>
      <h2>{ar ? "واصل إيقاع دراستك" : "Continue your study rhythm"}</h2>
      <p className="auth-subtitle">
        {ar
          ? "رقمك الجامعي وسنتك الدراسية، ولا شيء غير ذلك."
          : "Your college ID and academic year — nothing else to remember."}
      </p>
      {notice && (
        <p className="auth-notice" role="status">
          <Info aria-hidden="true" />
          {notice}
        </p>
      )}
      {failure && (
        <p className="auth-notice danger" role="alert">
          <TriangleAlert aria-hidden="true" />
          {failure}
        </p>
      )}
      <SignInForm locale={locale} callbackUrl={safeCallback(query.callbackUrl)} />
      <div className="auth-links">
        <Link href="/forgot-password">{ar ? "نسيت كلمة المرور؟" : "Forgot password?"}</Link>
        <Link href="/sign-up">{ar ? "إنشاء حساب" : "Create an account"}</Link>
      </div>
    </div>
  );
}
