import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTaskDateWindow } from "@/lib/tasks/dates";

/**
 * Read model for the /admin console. Every function here is server-only and called from
 * admin-guarded server components -- there is deliberately no HTTP layer for reads, so
 * the only privileged API surface is /api/admin/actions (mutations).
 *
 * Day bucketing uses Africa/Cairo to match how the rest of the app defines "a day"
 * (getTaskDateWindow). Raw SQL appears only as tagged templates with bound parameters --
 * no string interpolation anywhere.
 */

const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ overview */

export async function getOverview() {
  const now = new Date();
  const today = getTaskDateWindow("today", now)!;
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);

  const [
    usersTotal,
    usersNew7,
    usersNew30,
    activeTodayRows,
    viewsToday,
    views7,
    tasksTotal,
    tasksCompleted,
    sessionsTotal,
    sessionsCompleted,
    minutesAgg,
    minutesTodayAgg,
    timersActive,
    roomsOpen,
    challengesActive,
    aiJobsToday,
    tokensTodayAgg,
    pendingResets,
    signups14,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: d7 } } }),
    prisma.user.count({ where: { createdAt: { gte: d30 } } }),
    // Distinct signed-in visitors today; anonymous views are counted by viewsToday.
    prisma.pageView.findMany({
      where: { createdAt: today, userId: { not: null } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.pageView.count({ where: { createdAt: today } }),
    prisma.pageView.count({ where: { createdAt: { gte: d7 } } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null, status: "COMPLETED" } }),
    prisma.studySession.count(),
    prisma.studySession.count({ where: { status: "COMPLETED" } }),
    prisma.studySession.aggregate({
      where: { status: "COMPLETED" },
      _sum: { durationSeconds: true },
    }),
    prisma.studySession.aggregate({
      where: { status: "COMPLETED", endedAt: today },
      _sum: { durationSeconds: true },
    }),
    prisma.timerRun.count({ where: { status: { in: ["RUNNING", "PAUSED"] } } }),
    prisma.room.count({ where: { archivedAt: null } }),
    prisma.challenge.count({ where: { status: { in: ["PENDING", "SCHEDULED", "ACTIVE"] } } }),
    prisma.aIJob.count({ where: { createdAt: today } }),
    prisma.serviceUsageLog.aggregate({
      where: { service: "groq", occurredAt: today },
      _sum: { units: true },
    }),
    prisma.manualPasswordResetRequest.count({ where: { status: "PENDING" } }),
    dailySignups(14, now),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { admin: { select: { name: true } } },
    }),
  ]);

  return {
    generatedAt: now.toISOString(),
    stats: {
      usersTotal,
      usersNew7,
      usersNew30,
      activeUsersToday: activeTodayRows.length,
      viewsToday,
      views7,
      tasksTotal,
      tasksCompleted,
      completionRate: tasksTotal ? Math.round((tasksCompleted / tasksTotal) * 100) : 0,
      sessionsTotal,
      sessionsCompleted,
      minutesTotal: Math.round((minutesAgg._sum.durationSeconds ?? 0) / 60),
      minutesToday: Math.round((minutesTodayAgg._sum.durationSeconds ?? 0) / 60),
      timersActive,
      roomsOpen,
      challengesActive,
      aiJobsToday,
      tokensToday: tokensTodayAgg._sum.units ?? 0,
      pendingResets,
    },
    signups14,
    recentAudit,
  };
}

async function dailySignups(days: number, now: Date) {
  const since = new Date(now.getTime() - days * 86400000);
  return prisma.$queryRaw<{ day: Date; count: number }[]>`
    SELECT ("createdAt" AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(*)::int AS count
    FROM "User" WHERE "createdAt" >= ${since}
    GROUP BY 1 ORDER BY 1`;
}

/* ------------------------------------------------------------------ users */

export async function listUsers({ q, page = 1 }: { q?: string; page?: number }) {
  const trimmed = q?.trim();
  const where: Prisma.UserWhereInput | undefined = trimmed
    ? {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { email: { contains: trimmed, mode: "insensitive" } },
          // Admin console is exempt from the student-facing exact-match privacy rule:
          // support ("why can't I log in") requires finding partial IDs.
          { collegeId: { contains: trimmed.toUpperCase(), mode: "insensitive" } },
        ],
      }
    : undefined;

  const take = PAGE_SIZE;
  const skip = Math.max(0, page - 1) * take;
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        collegeId: true,
        name: true,
        email: true,
        academicYear: true,
        role: true,
        createdAt: true,
        _count: { select: { tasks: true, sessions: true, goals: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
  ]);
  const ids = rows.map((r) => r.id);
  const [minutes, lastSeen] = await Promise.all([
    ids.length
      ? prisma.studySession.groupBy({
          by: ["userId"],
          where: { userId: { in: ids }, status: "COMPLETED" },
          _sum: { durationSeconds: true },
        })
      : Promise.resolve([] as { userId: string; _sum: { durationSeconds: number | null } }[]),
    ids.length
      ? prisma.pageView.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { createdAt: true },
        })
      : Promise.resolve([] as { userId: string; _max: { createdAt: Date | null } }[]),
  ]);
  const minutesById = new Map(minutes.map((m) => [m.userId, m._sum.durationSeconds ?? 0]));
  const seenById = new Map(lastSeen.map((m) => [m.userId, m._max.createdAt]));
  return {
    total,
    page,
    pageSize: take,
    pages: Math.max(1, Math.ceil(total / take)),
    users: rows.map((r) => ({
      ...r,
      minutes: Math.round((minutesById.get(r.id) ?? 0) / 60),
      lastSeenAt: seenById.get(r.id) ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ user detail */

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      collegeId: true,
      name: true,
      email: true,
      academicYear: true,
      role: true,
      timezone: true,
      leaderboardVisible: true,
      profileVisibility: true,
      aiNudgesEnabled: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
      preference: { select: { locale: true, studyMood: true, skin: true } },
      _count: {
        select: {
          subjects: true,
          tasks: true,
          sessions: true,
          goals: true,
          badges: true,
          insights: true,
          roomMessages: true,
          examPlans: true,
        },
      },
    },
  });
  if (!user) return null;
  const [
    recentTasks,
    recentSessions,
    activeTimers,
    recentAiJobs,
    usageAgg,
    manualResets,
    targetAudit,
  ] = await Promise.all([
    prisma.task.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true, title: true, status: true, priority: true,
        dueAt: true, completedAt: true, createdAt: true,
        subject: { select: { name: true } },
      },
      orderBy: [{ status: "desc" }, { dueAt: "asc" }],
      take: 20,
    }),
    prisma.studySession.findMany({
      where: { userId },
      select: {
        id: true, status: true, startedAt: true, endedAt: true,
        durationSeconds: true, focusScore: true, distractionCount: true,
        subject: { select: { name: true } },
        task: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.timerRun.findMany({
      where: { userId, status: { in: ["RUNNING", "PAUSED"] } },
      include: { room: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    }).then((timers) => {
      // Elapsed is a snapshot at query time; components must not call Date.now() during
      // render (react-compiler purity rule).
      const nowMs = Date.now();
      return timers.map((t) => ({
        ...t,
        elapsedMinutes: Math.round(
          (t.accumulatedActiveSeconds +
            (t.status === "RUNNING" && t.segmentStartedAt
              ? (nowMs - t.segmentStartedAt.getTime()) / 1000
              : 0)) /
            60,
        ),
        plannedMinutes: Math.round(t.durationSeconds / 60),
      }));
    }),
    prisma.aIJob.findMany({
      where: { userId },
      select: { id: true, type: true, status: true, errorCode: true, attempts: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.serviceUsageLog.aggregate({
      where: { userId, occurredAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      _sum: { units: true },
      _count: true,
    }),
    prisma.manualPasswordResetRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.auditLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { admin: { select: { name: true } } },
    }),
  ]);
  return {
    user,
    recentTasks,
    recentSessions,
    activeTimers,
    aiJobs: recentAiJobs,
    aiTokens30d: usageAgg._sum.units ?? 0,
    aiCalls30d: usageAgg._count,
    manualResets,
    targetAudit,
  };
}

/* ------------------------------------------------------------------ activity feeds */

export type ActivityType = "sessions" | "tasks" | "timers";
export type SessionStatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "ABANDONED";

export async function getActivity({
  type = "sessions",
  status = "ALL",
  userId,
  page = 1,
}: {
  type?: ActivityType;
  status?: SessionStatusFilter;
  userId?: string;
  page?: number;
}) {
  const take = PAGE_SIZE;
  const skip = Math.max(0, page - 1) * take;
  if (type === "timers") {
    const runs = await prisma.timerRun.findMany({
      where: {
        status: { in: ["RUNNING", "PAUSED"] },
        ...(userId ? { userId } : {}),
      },
      include: {
        user: { select: { id: true, name: true, collegeId: true } },
        room: { select: { id: true, name: true } },
        session: { select: { id: true } },
      },
      orderBy: { startedAt: "desc" },
      take,
      skip,
    });
    const total = await prisma.timerRun.count({
      where: { status: { in: ["RUNNING", "PAUSED"] }, ...(userId ? { userId } : {}) },
    });
    const now = new Date();
    return {
      type: "timers" as const,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / take)),
      rows: runs.map((r) => ({
        kind: "timer" as const,
        id: r.id,
        user: r.user,
        roomName: r.room?.name ?? null,
        mode: r.mode,
        status: r.status,
        startedAt: r.startedAt,
        elapsedMinutes: Math.round(
          (r.accumulatedActiveSeconds +
            (r.status === "RUNNING" && r.segmentStartedAt
              ? (now.getTime() - r.segmentStartedAt.getTime()) / 1000
              : 0)) /
            60,
        ),
        plannedMinutes: Math.round(r.durationSeconds / 60),
      })),
    };
  }
  if (type === "tasks") {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(userId ? { userId } : {}),
      ...(status === "COMPLETED" ? { status: "COMPLETED" } : status === "ACTIVE" ? { status: { not: "COMPLETED" } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        select: {
          id: true, title: true, status: true, priority: true,
          dueAt: true, completedAt: true, createdAt: true,
          user: { select: { id: true, name: true, collegeId: true } },
          subject: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
    ]);
    return {
      type: "tasks" as const,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / take)),
      rows: rows.map((r) => ({ kind: "task" as const, ...r })),
    };
  }
  const where: Prisma.StudySessionWhereInput = {
    ...(userId ? { userId } : {}),
    // SessionStatus is ACTIVE | COMPLETED | ABANDONED -- "active" means not finished yet.
    ...(status === "COMPLETED"
      ? { status: "COMPLETED" }
      : status === "ABANDONED"
        ? { status: "ABANDONED" }
        : status === "ACTIVE"
          ? { status: "ACTIVE" }
          : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.studySession.count({ where }),
    prisma.studySession.findMany({
      where,
      select: {
        id: true, status: true, startedAt: true, endedAt: true,
        durationSeconds: true, focusScore: true, distractionCount: true,
        user: { select: { id: true, name: true, collegeId: true } },
        subject: { select: { name: true } },
        task: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
      take,
      skip,
    }),
  ]);
  return {
    type: "sessions" as const,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / take)),
    rows: rows.map((r) => ({ kind: "session" as const, ...r })),
  };
}

/* ------------------------------------------------------------------ logs */
export type AdminLogType = "audit" | "ai" | "usage" | "resets";

/* One function per log type: four boring, precisely-typed reads beat one clever
   discriminated union that every caller has to fight. Pages call exactly the one they
   render, so narrowing problems are structurally impossible. */

export async function getAuditLogs() {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: { admin: { select: { id: true, name: true } } },
  });
}

export async function getAiJobLogs() {
  return prisma.aIJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true, type: true, status: true, errorCode: true, attempts: true,
      model: true, createdAt: true,
      user: { select: { id: true, name: true, collegeId: true } },
    },
  });
}

export async function getUsageLogs() {
  return prisma.serviceUsageLog.findMany({
    where: { occurredAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    orderBy: { occurredAt: "desc" },
    take: 80,
    select: {
      id: true, service: true, operation: true, model: true, units: true,
      inputUnits: true, outputUnits: true, occurredAt: true,
      user: { select: { id: true, name: true, collegeId: true } },
    },
  });
}

export async function getResetRequestLogs() {
  return prisma.manualPasswordResetRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, details: true, status: true, reviewedBy: true,
      reviewedAt: true, createdAt: true,
      user: { select: { id: true, name: true, collegeId: true, email: true } },
    },
  });
}
/* ------------------------------------------------------------------ analytics */

export async function getAnalytics(days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const [minutesDaily, completionsDaily, viewsDaily, tokensDaily, hourHistogram, topUsers] =
    await Promise.all([
      prisma.$queryRaw<{ day: Date; minutes: number }[]>`
        SELECT ("endedAt" AT TIME ZONE 'Africa/Cairo')::date AS day,
               SUM("durationSeconds")::int AS minutes
        FROM "StudySession"
        WHERE "status" = 'COMPLETED' AND "endedAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT ("completedAt" AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(*)::int AS count
        FROM "Task"
        WHERE "status" = 'COMPLETED' AND "completedAt" >= ${since} AND "deletedAt" IS NULL
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ day: Date; count: number }[]>`
        SELECT ("createdAt" AT TIME ZONE 'Africa/Cairo')::date AS day, COUNT(*)::int AS count
        FROM "PageView"
        WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ day: Date; tokens: number }[]>`
        SELECT ("occurredAt" AT TIME ZONE 'Africa/Cairo')::date AS day,
               SUM("units")::int AS tokens
        FROM "ServiceUsageLog"
        WHERE "service" = 'groq' AND "occurredAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ hour: number; sessions: number; minutes: number }[]>`
        SELECT EXTRACT(HOUR FROM ("startedAt" AT TIME ZONE 'Africa/Cairo'))::int AS hour,
               COUNT(*)::int AS sessions,
               (SUM("durationSeconds") / 60)::int AS minutes
        FROM "StudySession"
        WHERE "status" = 'COMPLETED' AND "startedAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.studySession.groupBy({
        by: ["userId"],
        where: { status: "COMPLETED", startedAt: { gte: since } },
        _sum: { durationSeconds: true },
        orderBy: { _sum: { durationSeconds: "desc" } },
        take: 8,
      }),
    ]);

  const topIds = topUsers.map((t) => t.userId);
  const topNames = topIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, collegeId: true },
      })
    : [];
  const nameById = new Map(topNames.map((u) => [u.id, u]));

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    days,
    minutesDaily: minutesDaily.map((r) => ({ day: iso(r.day), minutes: Math.round(r.minutes / 60) })),
    completionsDaily: completionsDaily.map((r) => ({ day: iso(r.day), count: r.count })),
    viewsDaily: viewsDaily.map((r) => ({ day: iso(r.day), count: r.count })),
    tokensDaily: tokensDaily.map((r) => ({ day: iso(r.day), tokens: r.tokens })),
    hourHistogram: hourHistogram.map((r) => ({
      hour: Number(r.hour),
      sessions: r.sessions,
      minutes: r.minutes,
    })),
    topUsers: topUsers.map((t) => ({
      user: nameById.get(t.userId) ?? { id: t.userId, name: "Deleted user", collegeId: "" },
      hours: Math.round((t._sum.durationSeconds ?? 0) / 3600),
    })),
  };
}
