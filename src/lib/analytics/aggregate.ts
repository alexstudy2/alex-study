import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

export async function analyticsAggregate(userId: string, from: Date, to: Date, subjectId?: string) {
  const subject = subjectId ? { subjectId } : {};
  const [sessions, tasks, subjects] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: from, lte: to }, ...subject },
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
        OR: [{ dueAt: { gte: from, lte: to } }, { completedAt: { gte: from, lte: to } }],
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
  const dayCount = Math.max(
    1,
    differenceInCalendarDays(
      toZonedTime(to, DEFAULT_TIMEZONE),
      toZonedTime(from, DEFAULT_TIMEZONE),
    ) + 1,
  );
  const days = Array.from({ length: dayCount }, (_, index) =>
    addDays(startOfDay(toZonedTime(from, DEFAULT_TIMEZONE)), index),
  );
  const daily = days.map((day) => {
    const key = day.toISOString().slice(0, 10);
    const daySessions = sessions.filter(
      (item) => toZonedTime(item.startedAt, DEFAULT_TIMEZONE).toISOString().slice(0, 10) === key,
    );
    const dayTasks = tasks.filter(
      (item) =>
        item.completedAt &&
        toZonedTime(item.completedAt, DEFAULT_TIMEZONE).toISOString().slice(0, 10) === key,
    );
    return {
      date: key,
      minutes: Math.round(daySessions.reduce((sum, item) => sum + item.durationSeconds, 0) / 60),
      plannedMinutes: Math.round(
        daySessions.reduce((sum, item) => sum + item.plannedDurationSeconds, 0) / 60,
      ),
      tasksCompleted: dayTasks.length,
      distractions: daySessions.reduce((sum, item) => sum + item.distractionCount, 0),
    };
  });
  const studySeconds = sessions.reduce((sum, item) => sum + item.durationSeconds, 0);
  const plannedSeconds = sessions.reduce((sum, item) => sum + item.plannedDurationSeconds, 0);
  const completed = tasks.filter((item) => item.status === "COMPLETED").length;
  const due = tasks.filter((item) => item.dueAt).length;
  const scores = sessions.flatMap((item) => (item.focusScore == null ? [] : [item.focusScore]));
  const bySubject = subjects
    .map((item) => {
      const rows = sessions.filter((session) => session.subject?.id === item.id);
      return {
        ...item,
        minutes: Math.round(rows.reduce((sum, session) => sum + session.durationSeconds, 0) / 60),
        sessions: rows.length,
      };
    })
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    minutes: Math.round(
      sessions
        .filter((item) => toZonedTime(item.startedAt, DEFAULT_TIMEZONE).getHours() === hour)
        .reduce((sum, item) => sum + item.durationSeconds, 0) / 60,
    ),
  })).filter((item) => item.minutes > 0);
  return {
    from,
    to,
    summary: {
      studyMinutes: Math.round(studySeconds / 60),
      plannedMinutes: Math.round(plannedSeconds / 60),
      tasksCompleted: completed,
      tasksDue: due,
      distractionCount: sessions.reduce((sum, item) => sum + item.distractionCount, 0),
      averageFocusScore: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null,
      completionRate: due ? Math.round((completed / due) * 100) : 0,
    },
    daily,
    bySubject,
    byHour,
  };
}
