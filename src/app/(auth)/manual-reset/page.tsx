import { getLocale } from "next-intl/server";
import { ManualResetForm } from "@/components/auth/recovery-forms";

export default async function ManualResetPage() {
  const locale = (await getLocale()) === "ar" ? "ar" : "en";
  return (
    <div className="auth-content">
      <p className="eyebrow">{locale === "ar" ? "استعادة يدوية" : "Manual recovery"}</p>
      <h2>{locale === "ar" ? "اطلب مساعدة المسؤول" : "Request admin help"}</h2>
      <ManualResetForm locale={locale} />
    </div>
  );
}
