import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  const data = await analyticsAggregate(user.id, from, to);
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "تحليلات شخصية" : "Personal analytics"}
        title={ar ? "لاحظ النمط، لا تحكم على نفسك." : "Notice the pattern, not the pressure."}
        description={
          ar
            ? "تحليل بياني شامل لتوزيع ساعات الدراسة وجودة التركيز عبر الأيام والأسابيع."
            : "Visual patterns of your study volume, consistency, and focus depth over time."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/dashboard">
              {ar ? "الرئيسية" : "Dashboard"}
            </Link>
            <Link className="page-header-link" href="/sessions">
              {ar ? "الجلسات" : "Sessions"}
            </Link>
            <Link className="page-header-link" href="/insights">
              {ar ? "الرؤى" : "Insights"}
            </Link>
          </div>
        }
      />
      <AnalyticsView initialData={data} locale={locale} />
    </PageShell>
  );
}
