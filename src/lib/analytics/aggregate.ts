import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";
import { previousAnalyticsWindow } from "@/lib/analytics/window";

/* The session and task shapes the pure half of this module works on. Written out rather than
   inferred from the Prisma calls so `summarise` can be read -- and reviewed -- without chasing a
   generic back through the query. */
type SessionRow = {
  startedAt: Date;
  durationSeconds: number;
  plannedDurationSeconds: number;
  distractionCount: number;
  focusScore: number | null;
  subject: { id: string; name: string; colorToken: string } | null;
};

type TaskRow = {
  status: string;
  estimatedMinutes: number | null;
  dueAt: Date | null;
  completedAt: Date | null;
  subject: { id: string; name: string; colorToken: string } | null;
};

type SubjectRow = { id: string; name: string; colorToken: string };

/**
 * Session-length buckets, in minutes, for the "how long do your sessions actually run" histogram.
 *
 * Open-ended at the top (`to: null`) because there is no sensible upper bound on a study session
 * and a fixed last bucket would silently swallow a five-hour outlier into "90-120". The edges are
 * pomodoro-shaped on purpose: 25 and 50 are the two lengths this app's timer offers, so a student
 * can see at a glance whether they finish the length they picked.
 */
const LENGTH_BUCKETS: { from: number; to: number | null }[] = [
  { from: 0, to: 15 },
  { from: 15, to: 30 },
  { from: 30, to: 45 },
  { from: 45, to: 60 },
  { from: 60, to: 90 },
  { from: 90, to: null },
];

/** The local calendar date of an instant, as `YYYY-MM-DD`.
 *
 *  `toZonedTime` returns a Date whose *UTC* fields hold the Cairo wall-clock values, which is
 *  exactly what makes `.toISOString()` yield the local date here. Correct, but only because of
 *  that shift -- calling `.getDate()` on the result would read the browser's zone again. */
const dayKey = (date: Date) => toZonedTime(date, DEFAULT_TIMEZONE).toISOString().slice(0, 10);

const minutes = (seconds: number) => Math.round(seconds / 60);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const avg = (values: number[]) =>
  values.length ? Math.round((sum(values) / values.length) * 10) / 10 : null;

/**
 * Longest and current runs of consecutive active days.
 *
 * `daily` is already dense -- one entry per calendar day in the window, zeros included -- so a
 * single pass over it is the whole algorithm; no date arithmetic and no gap detection needed.
 *
 * The current streak counts backwards from the *end* of the window and deliberately tolerates one
 * inactive final day: at 09:00 today nobody has studied yet, and a streak that resets every
 * morning and comes back every afternoon is a number that punishes you for reading the page early.
 */
function streaks(daily: { minutes: number }[]) {
  let longest = 0;
  let run = 0;
  for (const day of daily) {
    run = day.minutes > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  let current = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (daily[i].minutes > 0) current += 1;
    else if (i === daily.length - 1) continue;
    else break;
  }
  return { currentStreak: current, longestStreak: longest };
}

/**
 * Everything derived from one window's rows. Pure, so the previous period is the same code path as
 * the current one -- the comparison numbers cannot drift from the numbers they are compared to.
 */
function summarise(sessions: SessionRow[], tasks: TaskRow[], subjects: SubjectRow[], from: Date, to: Date) {
  const dayCount = Math.max(
    1,
    differenceInCalendarDays(toZonedTime(to, DEFAULT_TIMEZONE), toZonedTime(from, DEFAULT_TIMEZONE)) + 1,
  );
  const days = Array.from({ length: dayCount }, (_, index) =>
    addDays(startOfDay(toZonedTime(from, DEFAULT_TIMEZONE)), index),
  );

  /* One pass to group by local date instead of a `.filter()` per day inside the map, which was
     O(days x sessions) -- 90 days against a heavy term's sessions is a lot of wasted scanning for
     a page that renders on every navigation. */
  const sessionsByDay = new Map<string, SessionRow[]>();
  for (const session of sessions) {
    const key = dayKey(session.startedAt);
    const bucket = sessionsByDay.get(key);
    if (bucket) bucket.push(session);
    else sessionsByDay.set(key, [session]);
  }
  const completionsByDay = new Map<string, number>();
  for (const task of tasks) {
    if (!task.completedAt) continue;
    const key = dayKey(task.completedAt);
    completionsByDay.set(key, (completionsByDay.get(key) ?? 0) + 1);
  }

  const daily = days.map((day) => {
    const key = day.toISOString().slice(0, 10);
    const rows = sessionsByDay.get(key) ?? [];
    const scores = rows.flatMap((row) => (row.focusScore == null ? [] : [row.focusScore]));
    return {
      date: key,
      minutes: minutes(sum(rows.map((row) => row.durationSeconds))),
      plannedMinutes: minutes(sum(rows.map((row) => row.plannedDurationSeconds))),
      tasksCompleted: completionsByDay.get(key) ?? 0,
      distractions: sum(rows.map((row) => row.distractionCount)),
      sessions: rows.length,
      /* null, not 0, when nothing was scored: a day with no sessions has no focus quality, and
         plotting it as zero would draw a cliff down to the axis every rest day. recharts skips
         nulls with `connectNulls`, which is the line the chart actually wants. */
      focusScore: avg(scores),
    };
  });

  const studySeconds = sum(sessions.map((row) => row.durationSeconds));
  const plannedSeconds = sum(sessions.map((row) => row.plannedDurationSeconds));

  /* Completion is measured over one population, and both ends of the fraction are scoped to this
     window by the date that defines them.

     It used to count `status === "COMPLETED"` over every task row against `dueAt != null` over
     every task row -- two different populations. A row reaches `summarise` if *either* of its dates
     lands in the window, so a task finished this week but due last week, or finished with no due
     date at all, went into the numerator and not the denominator: 4/3, reported as 133%. A
     percentage whose numerator is not a subset of its denominator is not a percentage.

     `completed` keys off `completedAt` rather than status for the same reason, which also makes it
     exactly the sum of `daily[].tasksCompleted` -- the two numbers are on the same page. */
  const within = (date: Date | null) => date != null && date >= from && date <= to;
  const completed = tasks.filter((task) => within(task.completedAt)).length;
  const dueTasks = tasks.filter((task) => within(task.dueAt));
  const dueCompleted = dueTasks.filter((task) => task.status === "COMPLETED").length;
  const scores = sessions.flatMap((row) => (row.focusScore == null ? [] : [row.focusScore]));

  const bySubject = subjects
    .map((subject) => {
      const rows = sessions.filter((session) => session.subject?.id === subject.id);
      const subjectScores = rows.flatMap((row) => (row.focusScore == null ? [] : [row.focusScore]));
      const subjectMinutes = minutes(sum(rows.map((row) => row.durationSeconds)));
      const distractions = sum(rows.map((row) => row.distractionCount));
      return {
        ...subject,
        minutes: subjectMinutes,
        sessions: rows.length,
        tasksCompleted: tasks.filter(
          (task) => task.subject?.id === subject.id && task.status === "COMPLETED",
        ).length,
        avgFocusScore: avg(subjectScores),
        distractions,
        avgSessionMinutes: rows.length ? Math.round(subjectMinutes / rows.length) : 0,
        /* Per *hour*, not per session: a 20-distraction 4-hour session and a 5-distraction
           30-minute one are not comparable any other way. Guarded against a course with tasks and
           no minutes, which is now allowed through the filter below. */
        distractionsPerHour: subjectMinutes
          ? Math.round((distractions / (subjectMinutes / 60)) * 10) / 10
          : 0,
      };
    })
    /* `minutes > 0 || tasksCompleted > 0`, where this used to be `minutes > 0` alone. A course you
       ticked five tasks off for but never ran the timer on was being dropped from the page
       entirely, which reads as "that course does not exist" rather than "that course has no
       timed sessions". */
    .filter((subject) => subject.minutes > 0 || subject.tasksCompleted > 0)
    .sort((a, b) => b.minutes - a.minutes || b.tasksCompleted - a.tasksCompleted);

  const hourMinutes = Array.from({ length: 24 }, () => 0);
  /* 7 rows x 24 columns of minutes. Dense, unlike `byHour` below, which is filtered to non-empty
     hours: a heatmap's empty cells are the information -- they are the shape of the week. */
  const byWeekdayHour = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const weekdayMinutes = Array.from({ length: 7 }, () => 0);
  const weekdaySessions = Array.from({ length: 7 }, () => 0);
  for (const session of sessions) {
    const local = toZonedTime(session.startedAt, DEFAULT_TIMEZONE);
    const hour = local.getHours();
    const weekday = local.getDay();
    const mins = minutes(session.durationSeconds);
    hourMinutes[hour] += mins;
    byWeekdayHour[weekday][hour] += mins;
    weekdayMinutes[weekday] += mins;
    weekdaySessions[weekday] += 1;
  }

  const sessionLengths = LENGTH_BUCKETS.map((bucket) => ({
    ...bucket,
    count: sessions.filter((session) => {
      const mins = session.durationSeconds / 60;
      return mins >= bucket.from && (bucket.to == null || mins < bucket.to);
    }).length,
  }));

  return {
    summary: {
      studyMinutes: minutes(studySeconds),
      plannedMinutes: minutes(plannedSeconds),
      tasksCompleted: completed,
      tasksDue: dueTasks.length,
      /* The subset of `tasksDue` that is done, which is what `completionRate` divides. Sent as its
         own field so the card can print the fraction it is a percentage *of* -- "3/4 due" -- rather
         than the two unrelated totals it used to show beneath a rate they did not produce. */
      tasksDueCompleted: dueCompleted,
      distractionCount: sum(sessions.map((row) => row.distractionCount)),
      /** Mean of `focusScore`, which the timer records on a 0-100 scale (`lib/sessions/timer.ts`). */
      averageFocusScore: avg(scores),
      /* null, not 0, when nothing was due: 0% is a verdict on a week where nothing was scheduled,
         and the reader cannot tell it apart from a week where everything was missed. */
      completionRate: dueTasks.length ? Math.round((dueCompleted / dueTasks.length) * 100) : null,
      sessionCount: sessions.length,
      avgSessionMinutes: sessions.length ? Math.round(minutes(studySeconds) / sessions.length) : 0,
      ...streaks(daily),
    },
    daily,
    bySubject,
    byHour: hourMinutes
      .map((mins, hour) => ({ hour, minutes: mins }))
      .filter((entry) => entry.minutes > 0),
    byWeekday: weekdayMinutes.map((mins, weekday) => ({
      weekday,
      minutes: mins,
      sessions: weekdaySessions[weekday],
    })),
    byWeekdayHour,
    sessionLengths,
  };
}

export type AnalyticsSummary = ReturnType<typeof summarise>["summary"];
export type AnalyticsData = Awaited<ReturnType<typeof analyticsAggregate>>;

export async function analyticsAggregate(userId: string, from: Date, to: Date, subjectId?: string) {
  const subject = subjectId ? { subjectId } : {};
  const days = differenceInCalendarDays(
    toZonedTime(to, DEFAULT_TIMEZONE),
    toZonedTime(from, DEFAULT_TIMEZONE),
  ) + 1;
  const previous = previousAnalyticsWindow(from, days);

  /* Both windows are fetched in one widened query and split in memory, rather than doubling the
     round trips. `@@index([userId, startedAt])` already covers the range, so asking for twice as
     many days costs one longer index scan instead of a second query, a second connection wait and
     a second plan. Every figure is derived after the split, so nothing leaks across the boundary. */
  const [sessions, tasks, subjects] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: previous.from, lte: to }, ...subject },
      select: {
        startedAt: true,
        durationSeconds: true,
        plannedDurationSeconds: true,
        distractionCount: true,
        focusScore: true,
        subject: { select: { id: true, name: true, colorToken: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        parentTaskId: null,
        OR: [
          { dueAt: { gte: previous.from, lte: to } },
          { completedAt: { gte: previous.from, lte: to } },
        ],
        ...subject,
      },
      select: {
        status: true,
        estimatedMinutes: true,
        dueAt: true,
        completedAt: true,
        subject: { select: { id: true, name: true, colorToken: true } },
      },
    }),
    prisma.subject.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
    }),
  ]);

  const inWindow = (start: Date, end: Date) => ({
    sessions: sessions.filter((row) => row.startedAt >= start && row.startedAt <= end),
    /* A task belongs to a window if either date lands in it -- the same `OR` the query uses. It
       can therefore be counted in both windows (due last week, completed this week), which is
       correct: it was one thing due then and one thing finished now. */
    tasks: tasks.filter(
      (row) =>
        (row.dueAt != null && row.dueAt >= start && row.dueAt <= end) ||
        (row.completedAt != null && row.completedAt >= start && row.completedAt <= end),
    ),
  });

  const currentRows = inWindow(from, to);
  const previousRows = inWindow(previous.from, previous.to);
  const current = summarise(currentRows.sessions, currentRows.tasks, subjects, from, to);
  const before = summarise(previousRows.sessions, previousRows.tasks, subjects, previous.from, previous.to);

  return {
    from,
    to,
    days,
    subjectId: subjectId ?? null,
    ...current,
    /* Only the summary of the previous window travels. The client compares totals; it has no use
       for 90 more daily rows, and sending them would roughly double the payload. */
    previous: before.summary,
  };
}
