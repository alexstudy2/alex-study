import Link from "next/link";
import { getLocale } from "next-intl/server";
import { RegisterForm } from "@/components/auth/auth-forms";

export default async function SignUpPage() {
  const locale = (await getLocale()) === "ar" ? "ar" : "en";
  const ar = locale === "ar";
  return (
    <div className="auth-content">
      <p className="eyebrow">{ar ? "انضم إلى مجتمع كليتك" : "Join your college community"}</p>
      <h2>{ar ? "أنشئ حساب Alex Study" : "Create your Alex Study account"}</h2>
      <RegisterForm locale={locale} />
      <p className="fine-print">
        {ar
          ? "يستخدم الرقم الجامعي للدخول الآمن ولا يظهر علنا."
          : "Your college ID is used only for secure access and is never shown publicly."}
      </p>
      <Link href="/sign-in">{ar ? "لديك حساب؟ سجل الدخول" : "Already registered? Sign in"}</Link>
    </div>
  );
}
