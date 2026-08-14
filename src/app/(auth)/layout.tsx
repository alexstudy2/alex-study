import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlexStudyLogo } from "@/components/ui/logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const ar = (await getLocale()) === "ar";
  return (
    <main className="auth-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="auth-brand">
        <p className="eyebrow">
          {ar ? "كلية الطب · جامعة الإسكندرية" : "Faculty of Medicine · Alexandria University"}
        </p>
        <Link href="/" className="wordmark">
          <AlexStudyLogo size={42} />
        </Link>
        <h1>
          {ar ? (
            <>
              ادرس بوضوح.
              <br />
              وتقدم مع دفعتك.
            </>
          ) : (
            <>
              Study with clarity.
              <br />
              Grow with your class.
            </>
          )}
        </h1>
        <p>
          {ar
            ? "مساحة دراسة هادئة وداعمة صممت لطلاب طب الإسكندرية."
            : "A focused, supportive study space built exclusively for Alexandria medical students."}
        </p>
      </section>
      <section className="auth-panel">{children}</section>
    </main>
  );
}
