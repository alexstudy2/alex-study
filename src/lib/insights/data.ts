import "server-only";

import { startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";
import type { PersonalSignalData } from "./signals";

export async function loadPersonalSignalData(
  userId: string,
  now = new Date(),
): Promise<PersonalSignalData> {
  const localNow = toZonedTime(now, DEFAULT_TIMEZONE);
  const from = fromZonedTime(startOfDay(subDays(localNow, 42)), DEFAULT_TIMEZONE);
  const [sessions, tasks] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, status: "COMPLETED", startedAt: { gte: from, lte: now } },
      select: {
        startedAt: true,
        durationSeconds: true,
        plannedDurationSeconds: true,
        distractionCount: true,
        focusScore: true,
        subject: { select: { name: true } },
      },
      orderBy: { startedAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        parentTaskId: null,
        OR: [{ completedAt: { gte: from, lte: now } }, { dueAt: { gte: from, lte: now } }],
      },
      select: { completedAt: true, dueAt: true },
    }),
  ]);
  return {
    sessions: sessions.map((session) => ({
      startedAt: session.startedAt,
      durationSeconds: session.durationSeconds,
      plannedDurationSeconds: session.plannedDurationSeconds,
      distractionCount: session.distractionCount,
      focusScore: session.focusScore,
      subjectName: session.subject?.name ?? null,
    })),
    tasks,
  };
}

export function currentCairoDateKey(now = new Date()) {
  return toZonedTime(now, DEFAULT_TIMEZONE).toISOString().slice(0, 10);
}

export function recentCairoDayKey(now = new Date(), daysAgo = 0) {
  return toZonedTime(subDays(now, daysAgo), DEFAULT_TIMEZONE).toISOString().slice(0, 10);
}
