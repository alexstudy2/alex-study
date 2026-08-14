import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getTaskDateWindow } from "@/lib/tasks/dates";
import { goalsWithProgress } from "@/lib/goals/queries";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Sparkles,
  Target,
  Timer as TimerIcon,
  ArrowRight,
  ArrowLeft,
  ListTodo,
} from "lucide-react";

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
    todaySessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60
  );
  const planned =
    todaySessions.reduce((sum, item) => sum + item.plannedDurationSeconds, 0) / 60 +
    dueTasks.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
  const weekMinutes = Math.round(
    weekSessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60
  );
  const scores = todaySessions.flatMap((item) =>
    item.focusScore == null ? [] : [item.focusScore]
  );
  const averageScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;
  const completedWeek = weekTasks.filter((item) => item.status === "COMPLETED").length;

  const dateFormatted = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Cairo",
  }).format(now);

  const NavArrow = ar ? ArrowLeft : ArrowRight;

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={`Alex Study · ${dateFormatted}`}
        title={ar ? `أهلًا، ${user.name?.split(" ")[0]}` : `Welcome back, ${user.name?.split(" ")[0]}`}
        description={ar ? "خطة اليوم، بهدوء ووضوح." : "Today's plan, calm and legible."}
        actions={
          <>
            <Button
              href="/tasks"
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {ar ? "إضافة مهمة" : "New task"}
            </Button>
            <Button
              href="/focus"
              variant="secondary"
              size="sm"
              leftIcon={<Play className="w-4 h-4" />}
            >
              {ar ? "بدء الجلسة" : "Start focus"}
            </Button>
          </>
        }
      />

      {timer && (
        <Link className="active-timer-banner" href="/focus">
          <div className="flex items-center gap-2">
            <TimerIcon className="w-5 h-5 text-accent animate-pulse" />
            <span>
              {timer.status === "PAUSED"
                ? ar
                  ? "مؤقت متوقف مؤقتًا"
                  : "Timer paused"
                : ar
                ? "جلسة جارية"
                : "Session in progress"}
            </span>
          </div>
          <strong className="flex items-center gap-1.5 text-accent">
            {ar ? "العودة إلى المؤقت" : "Return to timer"}
            <NavArrow className="w-4 h-4" />
          </strong>
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
          <Button
            href="/focus"
            variant="accent"
            size="sm"
            leftIcon={<Play className="w-4 h-4" />}
          >
            {ar ? "ابدأ التركيز" : "Start focus"}
          </Button>
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
            <h2 className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              <span>{ar ? "ما يستحق انتباهك" : "What needs attention"}</span>
            </h2>
            <Link href="/tasks" className="text-sm font-semibold flex items-center gap-1 text-primary hover:underline">
              {ar ? "كل المهام" : "All tasks"}
              <NavArrow className="w-3.5 h-3.5" />
            </Link>
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
            <h2 className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <span>{ar ? "الأهداف النشطة" : "Active goals"}</span>
            </h2>
            <Link href="/goals" className="text-sm font-semibold flex items-center gap-1 text-accent-strong hover:underline">
              {ar ? "كل الأهداف" : "All goals"}
              <NavArrow className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="dashboard-goals">
            {goals.filter((goal) => goal.status === "ACTIVE").length ? (
              goals
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
                ))
            ) : (
              <div className="quiet-state" style={{ padding: "16px", textAlign: "center" }}>
                <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
                  {ar ? "لا توجد أهداف نشطة." : "No active goals."}
                </p>
                <Link href="/goals" style={{ textDecoration: "underline", color: "var(--accent)" }}>
                  {ar ? "أنشئ هدفك الأول" : "Create your first goal"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {insight && (
        <aside className="insight-card">
          <div>
            <span className="ai-label flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              AI
            </span>
            <p className="eyebrow">{ar ? "ملاحظة دراسية" : "Study note"}</p>
            <h2>{insight.title}</h2>
            <p>{insight.content}</p>
          </div>
          <Link href="/sessions" className="flex items-center gap-1 font-semibold">
            {ar ? "راجع جلساتك" : "Review sessions"}
            <NavArrow className="w-4 h-4" />
          </Link>
        </aside>
      )}
    </PageShell>
  );
}
