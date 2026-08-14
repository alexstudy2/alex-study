import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { InsightList } from "@/components/insights/insight-list";
import { insightSelect } from "@/lib/insights/service";
export default async function InsightsPage() {
  const user = await requireUser();
  const [insights, profile] = await Promise.all([
    prisma.aIInsight.findMany({
      where: { userId: user.id, dismissedAt: null, purgeAt: { gt: new Date() } },
      select: insightSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { aiNudgesEnabled: true } }),
  ]);
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main className="insights-shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="insights-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">
            {locale === "ar" ? "رؤى مدعومة بالذكاء الاصطناعي" : "AI-supported insights"}
          </p>
          <h1>
            {locale === "ar" ? "إشارة صغيرة، وليست حكمًا." : "A small signal, never a verdict."}
          </h1>
        </div>
        <nav aria-label={locale === "ar" ? "تنقل الرؤى" : "Insights navigation"}>
          <Link href="/dashboard">{locale === "ar" ? "الرئيسية" : "Dashboard"}</Link>
          <Link href="/analytics">{locale === "ar" ? "التحليلات" : "Analytics"}</Link>
          <Link href="/exam-plans/new">{locale === "ar" ? "خطة امتحان" : "Exam planner"}</Link>
        </nav>
      </header>
      <InsightList
        initialInsights={insights}
        locale={locale}
        aiEnabled={profile?.aiNudgesEnabled ?? true}
      />
    </main>
  );
}
