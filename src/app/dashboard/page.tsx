import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getTaskDateWindow } from "@/lib/tasks/dates";
import { goalsWithProgress } from "@/lib/goals/queries";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { TodayTasksSticky } from "@/components/dashboard/today-tasks-sticky";
import { TodayStudyCard } from "@/components/dashboard/today-study-card";
import {
  CalendarDays,
  Play,
  Plus,
  Sparkles,
  Target,
  Timer as TimerIcon,
  ArrowRight,
  ArrowLeft,
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

  const [todayTasks, weekTasks, todaySessions, weekSessions, goals, insight, timer, subjects] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          parentTaskId: null,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          OR: [
            { dueAt: today },
            { status: "IN_PROGRESS" },
            {
              timerRuns: {
                some: { mode: "FOCUS", status: { in: ["RUNNING", "PAUSED"] } },
              },
            },
          ],
        },
        include: { subject: true },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
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
        select: {
          mode: true,
          status: true,
          durationSeconds: true,
          accumulatedActiveSeconds: true,
          segmentStartedAt: true,
        },
      }),
      /* Feeds the quick-add's course picker. Same shape and ordering as /tasks (see
         src/app/tasks/page.tsx) so a course sits in the same place in both lists. */
      prisma.subject.findMany({
        where: { userId: user.id, archivedAt: null },
        select: { id: true, name: true, colorToken: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const ar = user.locale === "AR";
  const completedTodaySeconds = todaySessions.reduce((sum, item) => sum + item.durationSeconds, 0);
  const planned =
    todaySessions.reduce((sum, item) => sum + item.plannedDurationSeconds, 0) / 60 +
    todayTasks.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);
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
      {/* 1. Header Hero Card */}
      <section className="dashboard-hero-card mb-6">
        <div className="dashboard-hero-content">
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-primary" />
              {dateFormatted}
            </span>
            <h1 className="dashboard-hero-title">
              {ar ? `مرحبًا ${user.name?.split(" ")[0]}` : `Welcome, ${user.name?.split(" ")[0]}`}
            </h1>
            <p className="dashboard-hero-sub">
              {ar
                ? "حدد أولوياتك لليوم وابدأ جلسة تركيز للتقدم بخطوات ثابتة."
                : "Set your daily priorities and start a focused session to make steady progress."}
            </p>
          </div>

          <div className="dashboard-hero-actions">
            <Button
              href="/focus"
              variant="primary"
              size="md"
              leftIcon={<Play className="w-4 h-4" />}
            >
              {ar ? "بدء التركيز" : "Start Focus"}
            </Button>
            <Button
              href="/tasks"
              variant="secondary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {ar ? "إدارة المهام" : "Manage Tasks"}
            </Button>
          </div>
        </div>
      </section>

      {/* 2. Active Timer Alert (Conditional) */}
      {timer && (
        <Link className="active-timer-banner" href="/focus">
          <div className="flex items-center gap-2">
            <TimerIcon className="w-5 h-5 text-accent animate-pulse" />
            <span className="font-bold">
              {timer.status === "PAUSED"
                ? ar
                  ? "المؤقت متوقف مؤقتًا — استكمل جلستك"
                  : "Timer is paused — resume session"
                : ar
                ? "جلسة تركيز جارية الآن"
                : "Focus session in progress"}
            </span>
          </div>
          <strong className="flex items-center gap-1.5 text-accent font-bold">
            {ar ? "العودة إلى المؤقت" : "Return to timer"}
            <NavArrow className="w-4 h-4" />
          </strong>
        </Link>
      )}

      {/* 3. Two-Column Dashboard Content Layout */}
      <div className="dashboard-layout-grid">
        {/* Left Column: Today's Tasks & Checklist */}
        <section className="dashboard-left-col flex flex-col gap-6">
          {/* Today's Tasks Sticky Note Card */}
          <TodayTasksSticky tasks={todayTasks} subjects={subjects} ar={ar} />

          {/* AI Insight / Daily Study Note */}
          {insight && (
            <aside className="dashboard-memo-card">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="ai-label flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI Note
                </span>
                <Link
                  href="/insights"
                  className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
                >
                  {ar ? "سجل الرؤى" : "All notes"}
                  <NavArrow className="w-3 h-3" />
                </Link>
              </div>
              <h3 className="text-base font-bold text-secondary mb-1">
                {insight.title}
              </h3>
              <p className="text-sm text-foreground leading-relaxed">
                {insight.content}
              </p>
            </aside>
          )}
        </section>

        {/* Right Column: Today's Rhythm, Pulse & Goals */}
        <section className="dashboard-right-col flex flex-col gap-6">
          <TodayStudyCard
            ar={ar}
            completedTodaySeconds={completedTodaySeconds}
            plannedMinutes={planned}
            weekMinutes={weekMinutes}
            completedWeek={completedWeek}
            averageScore={averageScore}
            serverNow={now.toISOString()}
            timer={timer}
          />

          {/* Active Goals Card */}
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <h2 className="text-lg font-bold">
                  {ar ? "الأهداف النشطة" : "Active Goals"}
                </h2>
              </div>
              <Link
                href="/goals"
                className="text-xs font-bold text-accent-strong hover:underline flex items-center gap-1"
              >
                {ar ? "إدارة الأهداف" : "All goals"}
                <NavArrow className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="dashboard-goals-list mt-3 flex flex-col gap-2">
              {goals.filter((g) => g.status === "ACTIVE").length > 0 ? (
                goals
                  .filter((g) => g.status === "ACTIVE")
                  .slice(0, 3)
                  .map((goal) => (
                    <Link
                      href={`/goals/${goal.id}`}
                      key={goal.id}
                      className="goal-item-card flex flex-col gap-1.5 p-3 rounded-md border border-secondary bg-surface hover:shadow-doodle transition-all text-inherit no-underline"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <strong className="truncate font-bold text-foreground">
                          {goal.title}
                        </strong>
                        <span className="font-mono text-muted text-[11px] shrink-0">
                          {goal.progress.currentValue} / {goal.targetValue}
                        </span>
                      </div>
                      <div className="dashboard-progress mb-0 h-1.5">
                        <span style={{ width: `${goal.progress.percentage}%` }} />
                      </div>
                    </Link>
                  ))
              ) : (
                <div className="text-center p-4 border border-dashed border-line rounded-md">
                  <Link
                    href="/goals"
                    className="text-xs font-bold text-accent-strong hover:underline"
                  >
                    {ar ? "+ أنشئ هدفًا دراسيًا جديدًا" : "+ Create a new study goal"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
