import type { LeaderboardMetric, LeaderboardScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  eligibleSessions,
  eligibleTasks,
  rankedRows,
  utcLeaderboardWeek,
} from "@/lib/challenges/rules";

type ScopeInput = {
  scope: LeaderboardScope;
  ownerUserId?: string;
  academicYear?: number;
  metric: LeaderboardMetric;
  now?: Date;
  persistSnapshot?: boolean;
};

export async function buildLeaderboard(input: ScopeInput) {
  const now = input.now ?? new Date();
  const { start, end } = utcLeaderboardWeek(now);
  let candidateIds: string[] | undefined;
  if (input.scope === "FRIENDS") {
    if (!input.ownerUserId) throw new Error("Friends leaderboard requires an owner");
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: input.ownerUserId }, { addresseeId: input.ownerUserId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    candidateIds = [
      input.ownerUserId,
      ...friendships.map((item) =>
        item.requesterId === input.ownerUserId ? item.addresseeId : item.requesterId,
      ),
    ];
  }
  const users = await prisma.user.findMany({
    where: {
      leaderboardVisible: true,
      ...(candidateIds ? { id: { in: candidateIds } } : {}),
      ...(input.academicYear ? { academicYear: input.academicYear } : {}),
    },
    select: { id: true, name: true, academicYear: true, imageUrl: true },
  });
  const ids = users.map((user) => user.id);
  const [tasks, sessions] = ids.length
    ? await Promise.all([
        prisma.task.findMany({
          where: { userId: { in: ids }, completedAt: { gte: start, lt: end } },
          select: {
            id: true,
            userId: true,
            completedAt: true,
            estimatedMinutes: true,
            status: true,
            deletedAt: true,
            parentTaskId: true,
          },
        }),
        prisma.studySession.findMany({
          where: { userId: { in: ids }, endedAt: { gte: start, lt: end } },
          select: {
            id: true,
            userId: true,
            endedAt: true,
            durationSeconds: true,
            status: true,
            source: true,
          },
        }),
      ])
    : [[], []];
  const rows = users.map((user) => {
    const taskCount = eligibleTasks(
      tasks
        .filter((task) => task.userId === user.id)
        .map((task) => ({ ...task, subjectKey: null })),
    ).length;
    const studyMinutes = eligibleSessions(
      sessions
        .filter((session) => session.userId === user.id)
        .map((session) => ({ ...session, subjectKey: null })),
    ).reduce((sum, session) => sum + Math.floor(session.durationSeconds / 60), 0);
    return {
      userId: user.id,
      name: user.name,
      academicYear: user.academicYear,
      imageUrl: user.imageUrl,
      value: input.metric === "STUDY_MINUTES" ? studyMinutes : taskCount,
      secondaryValue: input.metric === "STUDY_MINUTES" ? taskCount : studyMinutes,
    };
  });
  const ranked = rankedRows(rows);
  if (!input.persistSnapshot)
    return { snapshot: null, rows: ranked, periodStart: start, periodEnd: end };

  const snapshotKey = [
    input.scope,
    input.ownerUserId ?? "college",
    input.academicYear ?? "all",
    input.metric,
    start.toISOString(),
  ].join(":");
  const snapshot = await prisma.$transaction(async (tx) => {
    const saved = await tx.leaderboardSnapshot.upsert({
      where: { snapshotKey },
      update: { periodEnd: end, generatedAt: now },
      create: {
        snapshotKey,
        scope: input.scope,
        ownerUserId: input.ownerUserId,
        academicYear: input.academicYear,
        periodStart: start,
        periodEnd: end,
        metric: input.metric,
        generatedAt: now,
      },
    });
    await tx.leaderboardEntry.deleteMany({ where: { snapshotId: saved.id } });
    if (ranked.length)
      await tx.leaderboardEntry.createMany({
        data: ranked.map((row) => ({
          snapshotId: saved.id,
          userId: row.userId,
          rank: row.rank,
          value: row.value,
          secondaryValue: row.secondaryValue,
        })),
      });
    return saved;
  });
  return { snapshot, rows: ranked, periodStart: start, periodEnd: end };
}

export async function runWeeklyLeaderboards(now = new Date()) {
  let generated = 0;
  for (const metric of ["STUDY_MINUTES", "TASKS_COMPLETED"] as const) {
    await buildLeaderboard({ scope: "ALL_COLLEGE", metric, now, persistSnapshot: true });
    generated += 1;
    for (let academicYear = 1; academicYear <= 6; academicYear++) {
      await buildLeaderboard({
        scope: "ALL_COLLEGE",
        metric,
        academicYear,
        now,
        persistSnapshot: true,
      });
      generated += 1;
    }
  }
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    for (const metric of ["STUDY_MINUTES", "TASKS_COMPLETED"] as const) {
      await buildLeaderboard({
        scope: "FRIENDS",
        ownerUserId: user.id,
        metric,
        now,
        persistSnapshot: true,
      });
      generated += 1;
    }
  }
  return { snapshotsGenerated: generated };
}
