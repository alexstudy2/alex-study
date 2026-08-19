import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { InsightList } from "@/components/insights/insight-list";
import { insightSelect } from "@/lib/insights/service";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Lightbulb } from "lucide-react";

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
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Lightbulb}
        eyebrow={ar ? "رؤى مدعومة بالذكاء الاصطناعي" : "AI-supported insights"}
        title={ar ? "إشارة صغيرة، وليست حكمًا." : "A small signal, never a verdict."}
        description={
          ar
            ? "ملاحظات وتوصيات دراسية ذكية مبنية على وتيرة جلساتك وتركيزك."
            : "Adaptive, reflective insights based on your recent study rhythm and focus."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/dashboard">
              {ar ? "الرئيسية" : "Dashboard"}
            </Link>
            <Link className="page-header-link" href="/analytics">
              {ar ? "التحليلات" : "Analytics"}
            </Link>
            <Link className="page-header-link" href="/exam-plans/new">
              {ar ? "خطة امتحان AI" : "AI Exam Plan"}
            </Link>
          </div>
        }
      />
      <InsightList
        initialInsights={insights}
        locale={locale}
        aiEnabled={profile?.aiNudgesEnabled ?? true}
      />
    </PageShell>
  );
}
