import { prisma } from "@/lib/db/prisma";
import { calendarWindow, type CalendarView } from "./dates";

export async function calendarEvents(userId: string, anchor: Date, view: CalendarView) {
  const { start, end } = calendarWindow(anchor, view);
  const [tasks, sessions] = await Promise.all([
    prisma.task.findMany({
      where: { userId, deletedAt: null, parentTaskId: null, dueAt: { gte: start, lte: end } },
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        priority: true,
        estimatedMinutes: true,
        subject: { select: { id: true, name: true, colorToken: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: start, lte: end } },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        durationSeconds: true,
        status: true,
        subject: { select: { id: true, name: true, colorToken: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
  ]);
  return [
    ...tasks.map((task) => ({
      type: "task" as const,
      id: task.id,
      startsAt: task.dueAt!,
      title: task.title,
      subject: task.subject,
      status: task.status,
      minutes: task.estimatedMinutes,
      priority: task.priority,
    })),
    ...sessions.map((session) => ({
      type: "session" as const,
      id: session.id,
      startsAt: session.startedAt,
      title: session.task?.title ?? session.subject?.name ?? "Study session",
      subject: session.subject,
      status: session.status,
      minutes: Math.round(session.durationSeconds / 60),
      priority: null,
    })),
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
