import Link from "next/link";
import { getLocale } from "next-intl/server";
import { SignUpWizard } from "@/components/auth/sign-up-wizard";

export default async function SignUpPage() {
  const locale = (await getLocale()) === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  return (
    /* Wider than the sign-in card: the preferences step puts a mood grid and three steppers
       side by side, and at the sign-in width they would each wrap to their own row. */
    <div className="auth-content auth-content-wide">
      <p className="eyebrow">{ar ? "انضم إلى مجتمع كليتك" : "Join your college community"}</p>
      <h2>{ar ? "أنشئ حساب Alex Study" : "Create your Alex Study account"}</h2>
      <p className="auth-subtitle">
        {ar
          ? "ثلاث خطوات قصيرة، ويبدأ حسابك مضبوطا على طريقتك في المذاكرة."
          : "Three short steps, and your account starts out tuned to the way you study."}
      </p>
      <SignUpWizard locale={locale} />
      <p className="fine-print">
        {ar
          ? "يستخدم الرقم الجامعي للدخول الآمن ولا يظهر علنا."
          : "Your college ID is used only for secure access and is never shown publicly."}
      </p>
      <div className="auth-links">
        <Link href="/sign-in">{ar ? "لديك حساب؟ سجل الدخول" : "Already registered? Sign in"}</Link>
        <Link href="/">{ar ? "رجوع للصفحة الرئيسية" : "Back to home"}</Link>
      </div>
    </div>
  );
}
