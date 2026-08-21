import Link from "next/link";
import { redirect } from "next/navigation";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, getTaskDateWindow } from "@/lib/tasks/dates";
import { goalsWithProgress } from "@/lib/goals/queries";
import { PageShell } from "@/components/ui/page-shell";
import { Button } from "@/components/ui/button";
import { TodayTasksSticky } from "@/components/dashboard/today-tasks-sticky";
import { TodayStudyCard } from "@/components/dashboard/today-study-card";
import { WeekHoursChart } from "@/components/dashboard/week-hours-chart";
import {
  CalendarDays,
  Play,
  Plus,
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

  const [todayTasks, weekTasks, todaySessions, weekSessions, goals, timer, subjects] =
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
        /* `startedAt` as well as the duration, because the week's total is no longer the only
           thing drawn from these rows -- the week curve buckets them per weekday. Still one
           query: the rows were already being fetched and this adds a column, not a round trip. */
        select: { durationSeconds: true, startedAt: true },
      }),
      goalsWithProgress(user.id),
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

  /* Minutes per weekday for the bar chart. Sunday-first, because that is the week
     `getTaskDateWindow("week")` selected these rows with -- see `addDays(dayStart, -dayStart.getDay())`
     in lib/tasks/dates.ts. Bucketing on any other first day would draw a chart whose seven bars do
     not add up to the "hours this week" total sitting beside them.

     `toZonedTime` before `.getDay()`, never the raw Date: a session at 01:00 Cairo is 23:00 UTC the
     previous day, so half of every late-night study block would land in the wrong column -- and on
     the machine that runs `next build` in another zone, a different half. */
  const weekdayMinutes = [0, 0, 0, 0, 0, 0, 0];
  for (const session of weekSessions) {
    const index = toZonedTime(session.startedAt, DEFAULT_TIMEZONE).getDay();
    weekdayMinutes[index] += session.durationSeconds / 60;
  }
  const todayIndex = toZonedTime(now, DEFAULT_TIMEZONE).getDay();
  /* Labels come off a fixed known Sunday (2024-01-07) read in UTC, not off this week's dates.
     Weekday *names* are the same in every week, so there is nothing to gain from the real dates and
     something to lose: stepping through them would mean adding days to an instant, and date-fns
     `addDays` works on local components, so on a DST boundary the seventh step can land twice on
     the same weekday. A frozen reference has no boundary to cross. */
  const weekdayLabel = (index: number, style: "narrow" | "long") =>
    new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { weekday: style, timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 7 + index))
    );
  const weekDays = weekdayMinutes.map((minutes, index) => ({
    label: weekdayLabel(index, "narrow"),
    full: weekdayLabel(index, "long"),
    minutes: Math.round(minutes),
    isToday: index === todayIndex,
    isFuture: index > todayIndex,
  }));

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
        {/* Atlas hero artwork. Decorative, so `aria-hidden` and no title/desc -- it repeats the
            headline rather than adding to it. Every colour is a palette token, which is what
            keeps one drawing correct in all five moods including the dark one; the only literal
            is the lantern glow, and that is a warmth the palette has no token for.
            Hidden for the doodle skin in components.css -- this page is a Server Component and
            never receives the skin, so the choice is made in CSS rather than threaded down. */}
        <svg
          className="dashboard-hero-art"
          viewBox="0 0 260 160"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* Concentric progress arcs -- the study rhythm, drawn as nested quarter turns. */}
          <circle cx="186" cy="84" r="62" stroke="var(--glass-rim)" strokeWidth="1" />
          <path
            d="M 186 22 A 62 62 0 0 1 248 84"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="186" cy="84" r="44" stroke="var(--glass-rim)" strokeWidth="1" />
          <path
            d="M 186 40 A 44 44 0 0 1 230 84"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="186" cy="84" r="4" fill="var(--primary)" />

          {/* The lighthouse of Alexandria, reduced to geometry -- the same motif the new logo
              mark is built from, so the page and the brand read as one drawing. */}
          <path d="M 20 138 L 108 138" stroke="var(--glass-rim-strong)" strokeWidth="1.5" />
          <path
            d="M 50 136 L 56 58 L 70 58 L 76 136 Z"
            stroke="var(--secondary)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M 52 108 L 74 108" stroke="var(--glass-rim-strong)" strokeWidth="1.25" />
          <path d="M 54 84 L 72 84" stroke="var(--glass-rim-strong)" strokeWidth="1.25" />
          <path
            d="M 54 58 L 54 44 L 72 44 L 72 58"
            stroke="var(--secondary)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M 50 44 L 63 30 L 76 44"
            stroke="var(--secondary)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="63" cy="51" r="3.5" fill="var(--warning)" />
          {/* The beam. Two rays rather than a cone: a cone at 50% opacity over glass turns to
              mud, where open strokes stay legible on every palette. */}
          <path
            d="M 78 46 L 132 30"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 78 56 L 132 66"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>

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

          {/* Study hours across the week. This tile used to hold the newest AI insight; the
              insights themselves are unchanged and still live at /insights. What sat here was a
              paragraph of generated prose in the one spot on the page where every neighbour is a
              number, and it read as an interruption rather than as part of the dashboard. One
              curve answers "how is my week going" at a glance, which is the question this column
              is for. */}
          <WeekHoursChart ar={ar} days={weekDays} totalMinutes={weekMinutes} />
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
                      /* Feeds the atlas skin's conic-gradient ring in components.css. A bare
                         number, not a percentage: the CSS multiplies by 1% itself, because
                         `calc()` inside a conic gradient's colour stop needs an <angle> or a
                         <percentage> and a custom property holding "42%" cannot be reused for
                         anything else. Set for both skins -- doodle ignores it, and branching
                         here would mean threading the skin into a Server Component that has no
                         other reason to know it. */
                      style={{ "--goal-pct": goal.progress.percentage } as React.CSSProperties}
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
