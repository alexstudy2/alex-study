import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { analyticsAggregate } from "@/lib/analytics/aggregate";
import { DEFAULT_ANALYTICS_DAYS, resolveAnalyticsWindow } from "@/lib/analytics/window";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { BarChart3 } from "lucide-react";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const window = resolveAnalyticsWindow(DEFAULT_ANALYTICS_DAYS);
  const [data, subjects, profile] = await Promise.all([
    analyticsAggregate(user.id, window.from, window.to),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
      orderBy: { name: "asc" },
    }),
    /* weekStartsOn drives the heatmap's row order and the weekday chart's axis. Read here rather
       than assumed to be Sunday: the column is configurable (`Int @default(0)`), and a Monday-first
       reader looking at a Sunday-first week misreads every gap in it. */
    prisma.user.findUnique({ where: { id: user.id }, select: { weekStartsOn: true } }),
  ]);
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={BarChart3}
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
      <AnalyticsView
        initialData={data}
        locale={locale}
        subjects={subjects}
        weekStartsOn={profile?.weekStartsOn ?? 0}
      />
    </PageShell>
  );
}
