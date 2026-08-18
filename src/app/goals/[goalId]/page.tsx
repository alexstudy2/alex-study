import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { goalsWithProgress } from "@/lib/goals/queries";
import { daysRemaining } from "@/lib/goals/progress";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Target } from "lucide-react";

export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const user = await requireUser();
  const { goalId } = await params;
  const goal = (await goalsWithProgress(user.id)).find((item) => item.id === goalId);
  if (!goal) notFound();
  const ar = user.locale === "AR";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Target}
        backHref="/goals"
        backLabel={ar ? "كل الأهداف" : "All goals"}
        isRtl={ar}
        eyebrow={goal.subject?.name ?? (ar ? "كل المواد" : "All subjects")}
        title={goal.title}
        actions={
          <div className="score-orbit">
            <strong>{goal.progress.percentage}%</strong>
            <span>{ar ? "اكتمل" : "complete"}</span>
          </div>
        }
      />
      <dl className="detail-metrics">
        <div>
          <dt>{ar ? "الحالي" : "Current"}</dt>
          <dd>{goal.progress.currentValue}</dd>
        </div>
        <div>
          <dt>{ar ? "المستهدف" : "Target"}</dt>
          <dd>{goal.targetValue}</dd>
        </div>
        <div>
          <dt>{ar ? "المتبقي بالأيام" : "Days remaining"}</dt>
          <dd>{Math.max(0, daysRemaining(goal.deadline))}</dd>
        </div>
        <div>
          <dt>{ar ? "الحالة" : "Status"}</dt>
          <dd>{goal.status}</dd>
        </div>
      </dl>
      <section className="reflection-card mt-6">
        <h2>{ar ? "كيف يُحسب التقدم" : "How progress is calculated"}</h2>
        <p>
          {goal.metric === "STUDY_MINUTES"
            ? ar
              ? "مجموع دقائق الجلسات المكتملة داخل فترة الهدف."
              : "Completed study-session minutes inside the goal window."
            : ar
              ? "عدد المهام المكتملة داخل فترة الهدف."
              : "Tasks completed inside the goal window."}
        </p>
      </section>
    </PageShell>
  );
}
