import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { goalsWithProgress } from "@/lib/goals/queries";
import { daysRemaining } from "@/lib/goals/progress";
export default async function GoalDetailPage({ params }: { params: Promise<{ goalId: string }> }) {
  const user = await requireUser();
  const { goalId } = await params;
  const goal = (await goalsWithProgress(user.id)).find((item) => item.id === goalId);
  if (!goal) notFound();
  const ar = user.locale === "AR";
  return (
    <main className="goal-detail-shell" dir={ar ? "rtl" : "ltr"}>
      <Link className="back-link" href="/goals">
        ← {ar ? "كل الأهداف" : "All goals"}
      </Link>
      <header className="goal-detail-header">
        <div>
          <p className="eyebrow">{goal.subject?.name ?? (ar ? "كل المواد" : "All subjects")}</p>
          <h1>{goal.title}</h1>
        </div>
        <div className="score-orbit">
          <strong>{goal.progress.percentage}%</strong>
          <span>{ar ? "اكتمل" : "complete"}</span>
        </div>
      </header>
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
      <section className="reflection-card">
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
    </main>
  );
}
