import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getTaskDateWindow } from "@/lib/tasks/dates";
import { goalsWithProgress } from "@/lib/goals/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const consent = await prisma.userConsent.findUnique({
    where: { userId_kind_version: { userId: user.id, kind: "analytics", version: "2026-08" } },
  });
  if (!consent || consent.status === "PENDING") redirect("/onboarding/privacy");
  const now = new Date();
  const today = getTaskDateWindow("today", now)!;
  const week = getTaskDateWindow("week", now)!;
  const [dueTasks, weekTasks, todaySessions, weekSessions, goals, insight, timer] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          parentTaskId: null,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          dueAt: today,
        },
        include: { subject: true },
        orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
        take: 5,
      }),
      prisma.task.findMany({
        where: { userId: user.id, deletedAt: null, parentTaskId: null, dueAt: week },
        select: { status: true, estimatedMinutes: true },
      }),
      prisma.studySession.findMany({
        where: { userId: user.id, status: "COMPLETED", startedAt: today },
        select: { durationSeconds: true, plannedDurationSeconds: true, focusScore: true },
      }),
      prisma.studySession.findMany({
        where: { userId: user.id, status: "COMPLETED", startedAt: week },
        select: { durationSeconds: true },
      }),
      goalsWithProgress(user.id),
      prisma.aIInsight.findFirst({
        where: {
          userId: user.id,
          dismissedAt: null,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.timerRun.findFirst({
        where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
        select: { mode: true, status: true },
      }),
    ]);
  const ar = user.locale === "AR";
  const actual = Math.round(
    todaySessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
  );
  const planned =
    todaySessions.reduce((sum, item) => sum + item.plannedDurationSeconds, 0) / 60 +
    dueTasks.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const weekMinutes = Math.round(
    weekSessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
  );
  const scores = todaySessions.flatMap((item) =>
    item.focusScore == null ? [] : [item.focusScore],
  );
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const completedWeek = weekTasks.filter((item) => item.status === "COMPLETED").length;
  return (
    <main className="dashboard-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            Alex Study ·{" "}
            {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "Africa/Cairo",
            }).format(now)}
          </p>
          <h1>
            {ar
              ? `أهلًا، ${user.name?.split(" ")[0]}`
              : `Welcome back, ${user.name?.split(" ")[0]}`}
          </h1>
          <p>{ar ? "خطة اليوم، بهدوء ووضوح." : "Today’s plan, calm and legible."}</p>
        </div>
        <div className="header-quick-actions">
          <Link className="primary-button" href="/tasks">
            {ar ? "+ إضافة مهمة" : "+ New task"}
          </Link>
          <Link className="secondary-button" href="/focus">
            {ar ? "بدء الجلسة" : "Start focus"}
          </Link>
        </div>
      </header>
      {timer && (
        <Link className="active-timer-banner" href="/focus">
          <span>
            {timer.status === "PAUSED"
              ? ar
                ? "مؤقت متوقف مؤقتًا"
                : "Timer paused"
              : ar
                ? "جلسة جارية"
                : "Session in progress"}
          </span>
          <strong>{ar ? "العودة إلى المؤقت ←" : "Return to timer →"}</strong>
        </Link>
      )}
      <section className="dashboard-grid">
        <article className="today-card">
          <p className="eyebrow">{ar ? "اليوم" : "Today"}</p>
          <div className="plan-number">
            <strong>{actual}</strong>
            <span>
              / {Math.round(planned)} {ar ? "دقيقة" : "minutes"}
            </span>
          </div>
          <div className="dashboard-progress">
            <span style={{ width: `${Math.min(100, planned ? (actual / planned) * 100 : 0)}%` }} />
          </div>
          <Link href="/focus" className="primary-button">
            {ar ? "ابدأ التركيز" : "Start focus"}
          </Link>
        </article>
        <article className="metric-card">
          <span>{ar ? "هذا الأسبوع" : "This week"}</span>
          <strong>{weekMinutes}</strong>
          <small>{ar ? "دقيقة دراسة" : "study minutes"}</small>
        </article>
        <article className="metric-card">
          <span>{ar ? "المهام المكتملة" : "Tasks completed"}</span>
          <strong>{completedWeek}</strong>
          <small>{ar ? "من المهام المؤرخة" : "dated this week"}</small>
        </article>
        <article className="metric-card accent">
          <span>{ar ? "متوسط التركيز" : "Average Focus Score"}</span>
          <strong>{averageScore ?? "—"}</strong>
          <small>{ar ? "لجلسات اليوم" : "for today’s sessions"}</small>
        </article>
      </section>
      <section className="dashboard-columns">
        <div>
          <div className="section-heading">
            <h2>{ar ? "ما يستحق انتباهك" : "What needs attention"}</h2>
            <Link href="/tasks">{ar ? "كل المهام" : "All tasks"}</Link>
          </div>
          <div className="dashboard-task-list">
            {dueTasks.length ? (
              dueTasks.map((task) => (
                <Link href={`/tasks/${task.id}`} key={task.id}>
                  <span>{task.subject?.name ?? (ar ? "عام" : "General")}</span>
                  <strong>{task.title}</strong>
                  <em>{task.estimatedMinutes ? `${task.estimatedMinutes} min` : "—"}</em>
                </Link>
              ))
            ) : (
              <div className="quiet-state">
                {ar ? "لا توجد مهام مستحقة اليوم." : "Nothing is due today."}
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="section-heading">
            <h2>{ar ? "الأهداف النشطة" : "Active goals"}</h2>
            <Link href="/goals">{ar ? "كل الأهداف" : "All goals"}</Link>
          </div>
          <div className="dashboard-goals">
            {goals
              .filter((goal) => goal.status === "ACTIVE")
              .slice(0, 3)
              .map((goal) => (
                <Link href={`/goals/${goal.id}`} key={goal.id}>
                  <strong>{goal.title}</strong>
                  <span>
                    {goal.progress.currentValue} / {goal.targetValue}
                  </span>
                  <div className="dashboard-progress">
                    <i style={{ width: `${goal.progress.percentage}%` }} />
                  </div>
                </Link>
              ))}
          </div>
        </div>
      </section>
      {insight && (
        <aside className="insight-card">
          <div>
            <span className="ai-label">AI</span>
            <p className="eyebrow">{ar ? "ملاحظة دراسية" : "Study note"}</p>
            <h2>{insight.title}</h2>
            <p>{insight.content}</p>
          </div>
          <Link href="/sessions">{ar ? "راجع جلساتك" : "Review sessions"}</Link>
        </aside>
      )}
    </main>
  );
}
