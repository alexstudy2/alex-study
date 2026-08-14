import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { AnalyticsView } from "@/components/analytics/analytics-view";
export default async function AnalyticsPage() {
  const user = await requireUser();
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  const data = await analyticsAggregate(user.id, from, to);
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main className="page-shell">
      <header className="analytics-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{locale === "ar" ? "تحليلات شخصية" : "Personal analytics"}</p>
          <h1>
            {locale === "ar"
              ? "لاحظ النمط، لا تحكم على نفسك."
              : "Notice the pattern, not the pressure."}
          </h1>
        </div>
        <nav>
          <Link href="/dashboard">{locale === "ar" ? "الرئيسية" : "Dashboard"}</Link>
          <Link href="/sessions">{locale === "ar" ? "الجلسات" : "Sessions"}</Link>
          <Link href="/insights">{locale === "ar" ? "الرؤى" : "Insights"}</Link>
        </nav>
      </header>
      <AnalyticsView initialData={data} locale={locale} />
    </main>
  );
}
