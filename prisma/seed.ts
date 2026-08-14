import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86400000);
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600000);

async function main() {
  const passwordHash = await hash("AlexStudy2026!", 12);
  const students = await Promise.all(
    [
      ["MED-2026-001", "Mariam Hassan", 3, "mariam.alex.study@example.com"],
      ["MED-2026-002", "Omar Adel", 3, "omar.alex.study@example.com"],
      ["MED-2026-003", "Nour Ahmed", 2, null],
      ["MED-2026-004", "Youssef Samir", 4, null],
    ].map(async ([collegeId, name, academicYear, email]) =>
      prisma.user.upsert({
        where: {
          collegeId_academicYear: {
            collegeId: String(collegeId),
            academicYear: Number(academicYear),
          },
        },
        update: {},
        create: {
          collegeId: String(collegeId),
          name: String(name),
          academicYear: Number(academicYear),
          email: email ? String(email) : null,
          passwordHash,
          preference: { create: { locale: "EN" } },
          consents: {
            create: { kind: "analytics", version: "2026-08", status: "ACCEPTED", decidedAt: now },
          },
        },
      }),
    ),
  );
  const [mariam, omar, nour, youssef] = students;
  const anatomy = await prisma.subject.upsert({
    where: { userId_normalizedName: { userId: mariam.id, normalizedName: "anatomy" } },
    update: {},
    create: { userId: mariam.id, name: "Anatomy", normalizedName: "anatomy", colorToken: "coral" },
  });
  const physiology = await prisma.subject.upsert({
    where: { userId_normalizedName: { userId: mariam.id, normalizedName: "physiology" } },
    update: {},
    create: {
      userId: mariam.id,
      name: "Physiology",
      normalizedName: "physiology",
      colorToken: "teal",
    },
  });
  const omarAnatomy = await prisma.subject.upsert({
    where: { userId_normalizedName: { userId: omar.id, normalizedName: "anatomy" } },
    update: {},
    create: { userId: omar.id, name: "Anatomy", normalizedName: "anatomy", colorToken: "teal" },
  });
  const youssefAnatomy = await prisma.subject.upsert({
    where: { userId_normalizedName: { userId: youssef.id, normalizedName: "anatomy" } },
    update: {},
    create: {
      userId: youssef.id,
      name: "Anatomy",
      normalizedName: "anatomy",
      colorToken: "coral",
    },
  });
  await prisma.task.createMany({
    data: [
      {
        userId: mariam.id,
        subjectId: anatomy.id,
        title: "Review brachial plexus",
        priority: "HIGH",
        estimatedMinutes: 45,
        dueAt: new Date(now.getTime() + 86400000),
      },
      {
        userId: mariam.id,
        subjectId: physiology.id,
        title: "Cardiac cycle questions",
        status: "COMPLETED",
        completedAt: daysAgo(1),
        estimatedMinutes: 30,
      },
      {
        userId: mariam.id,
        title: "Prepare histology flashcards",
        priority: "MEDIUM",
        estimatedMinutes: 25,
        dueAt: new Date(now.getTime() + 2 * 86400000),
      },
    ],
    skipDuplicates: true,
  });
  for (let day = 1; day <= 10; day++)
    await prisma.studySession.create({
      data: {
        userId: mariam.id,
        subjectId: day % 2 ? anatomy.id : physiology.id,
        startedAt: new Date(daysAgo(day).setHours(18, 0, 0, 0)),
        endedAt: new Date(daysAgo(day).setHours(18, 45, 0, 0)),
        durationSeconds: 2700,
        plannedDurationSeconds: 3000,
        distractionCount: day % 3 === 0 ? 2 : 0,
        focusScore: day % 3 === 0 ? 78 : 94,
        source: "SOLO",
      },
    });
  const friendshipPairKey = [mariam.id, omar.id].sort().join(":");
  const friendship = await prisma.friendship.upsert({
    where: { pairKey: friendshipPairKey },
    update: { status: "ACCEPTED", respondedAt: now },
    create: {
      requesterId: mariam.id,
      addresseeId: omar.id,
      pairKey: friendshipPairKey,
      status: "ACCEPTED",
      respondedAt: now,
    },
  });
  for (const friend of [nour, youssef]) {
    const pairKey = [mariam.id, friend.id].sort().join(":");
    await prisma.friendship.upsert({
      where: { pairKey },
      update: { status: "ACCEPTED", respondedAt: now, blockedById: null },
      create: {
        requesterId: mariam.id,
        addresseeId: friend.id,
        pairKey,
        status: "ACCEPTED",
        respondedAt: now,
      },
    });
  }
  const accountability = await prisma.accountabilityPair.upsert({
    where: { pairKey: friendshipPairKey },
    update: { status: "ACTIVE" },
    create: {
      userAId: [mariam.id, omar.id].sort()[0],
      userBId: [mariam.id, omar.id].sort()[1],
      createdById: mariam.id,
      pairKey: friendshipPairKey,
      status: "ACTIVE",
      respondedAt: now,
    },
  });
  await prisma.notification.create({
    data: {
      userId: mariam.id,
      type: "ACCOUNTABILITY_ACCEPTED",
      title: "Omar accepted your accountability invite",
      body: "You can pause or end the pairing at any time.",
      actionUrl: "/friends",
      deliveries: { create: { channel: "IN_APP", status: "SENT", sentAt: now } },
    },
  });
  const room = await prisma.room.create({
    data: {
      ownerId: mariam.id,
      name: "Third Year Evening Focus",
      description: "Quiet evening Pomodoros after lectures",
      visibility: "PUBLIC",
      members: {
        create: [
          { userId: mariam.id, role: "OWNER" },
          { userId: omar.id },
          { userId: nour.id },
          { userId: youssef.id },
        ],
      },
    },
  });
  const activeStart = daysAgo(3);
  const activeEnd = new Date(now.getTime() + 4 * 86400000);
  const competitiveSessions = [
    ["seed-phase9-session-mariam-1", mariam.id, anatomy.id, 60, 50, "SOLO"],
    ["seed-phase9-session-mariam-2", mariam.id, physiology.id, 38, 45, "SOLO"],
    ["seed-phase9-session-mariam-3", mariam.id, anatomy.id, 14, 40, "SOLO"],
    ["seed-phase9-session-mariam-manual", mariam.id, anatomy.id, 10, 90, "MANUAL"],
    ["seed-phase9-session-omar-1", omar.id, omarAnatomy.id, 55, 60, "SOLO"],
    ["seed-phase9-session-omar-2", omar.id, omarAnatomy.id, 30, 35, "SOLO"],
    ["seed-phase9-session-omar-3", omar.id, omarAnatomy.id, 8, 30, "SOLO"],
  ] as const;
  for (const [id, userId, subjectId, endedHoursAgo, minutes, source] of competitiveSessions) {
    const endedAt = hoursAgo(endedHoursAgo);
    await prisma.studySession.upsert({
      where: { id },
      update: {
        userId,
        subjectId,
        startedAt: new Date(endedAt.getTime() - minutes * 60000),
        endedAt,
        durationSeconds: minutes * 60,
        plannedDurationSeconds: minutes * 60,
        source,
        status: "COMPLETED",
      },
      create: {
        id,
        userId,
        subjectId,
        startedAt: new Date(endedAt.getTime() - minutes * 60000),
        endedAt,
        durationSeconds: minutes * 60,
        plannedDurationSeconds: minutes * 60,
        source,
        status: "COMPLETED",
      },
    });
  }

  const completedTaskData = [
    ["seed-phase9-task-mariam-1", mariam.id, anatomy.id, "Upper limb recall set", 72],
    ["seed-phase9-task-mariam-2", mariam.id, anatomy.id, "Anatomy spotter review", 60],
    ["seed-phase9-task-youssef-1", youssef.id, youssefAnatomy.id, "Thorax question set", 66],
    ["seed-phase9-task-youssef-2", youssef.id, youssefAnatomy.id, "Five-minute glossary", 54],
    ["seed-phase9-task-omar-board", omar.id, omarAnatomy.id, "Anatomy practice block", 20],
  ] as const;
  for (const [id, userId, subjectId, title, completedHoursAgo] of completedTaskData) {
    await prisma.task.upsert({
      where: { id },
      update: {
        userId,
        subjectId,
        title,
        status: "COMPLETED",
        completedAt: hoursAgo(completedHoursAgo),
        estimatedMinutes: id === "seed-phase9-task-youssef-2" ? 5 : 25,
        deletedAt: null,
      },
      create: {
        id,
        userId,
        subjectId,
        title,
        status: "COMPLETED",
        completedAt: hoursAgo(completedHoursAgo),
        estimatedMinutes: id === "seed-phase9-task-youssef-2" ? 5 : 25,
      },
    });
  }

  await prisma.user.update({ where: { id: nour.id }, data: { leaderboardVisible: false } });
  await prisma.user.updateMany({
    where: { id: { in: [mariam.id, omar.id, youssef.id] } },
    data: { leaderboardVisible: true },
  });
  await prisma.userPreference.upsert({
    where: { userId: mariam.id },
    update: { shareFullNameOnCards: false, challengeNotifications: true },
    create: {
      userId: mariam.id,
      locale: "EN",
      shareFullNameOnCards: false,
      challengeNotifications: true,
    },
  });

  const activeChallenge = await prisma.challenge.upsert({
    where: { shareToken: "seed-challenge-2026" },
    update: {
      creatorId: mariam.id,
      opponentId: omar.id,
      type: "STUDY_TIME",
      targetValue: 300,
      resolutionType: "DEADLINE_LEADER",
      startsAt: activeStart,
      endsAt: activeEnd,
      status: "ACTIVE",
      acceptedAt: activeStart,
      winnerId: null,
      resolvedAt: null,
      shareEnabled: false,
    },
    create: {
      creatorId: mariam.id,
      opponentId: omar.id,
      type: "STUDY_TIME",
      targetValue: 300,
      resolutionType: "DEADLINE_LEADER",
      startsAt: activeStart,
      endsAt: activeEnd,
      status: "ACTIVE",
      acceptedAt: activeStart,
      shareToken: "seed-challenge-2026",
    },
  });
  for (const [userId, value] of [
    [mariam.id, 135],
    [omar.id, 125],
  ] as const)
    await prisma.challengeProgress.upsert({
      where: { challengeId_userId: { challengeId: activeChallenge.id, userId } },
      update: { currentValue: value, finalValue: null },
      create: { challengeId: activeChallenge.id, userId, currentValue: value },
    });

  const activeSessionIds = competitiveSessions.map(([id]) => id);
  await prisma.challengeProgressEvent.deleteMany({
    where: {
      challengeId: activeChallenge.id,
      sourceType: "STUDY_SESSION",
      sourceId: { in: activeSessionIds },
    },
  });
  for (const [id, userId, , , minutes, source] of competitiveSessions) {
    if (source === "MANUAL") continue;
    const progress = await prisma.challengeProgress.findUniqueOrThrow({
      where: { challengeId_userId: { challengeId: activeChallenge.id, userId } },
    });
    const sourceSession = await prisma.studySession.findUniqueOrThrow({ where: { id } });
    await prisma.challengeProgressEvent.create({
      data: {
        challengeId: activeChallenge.id,
        progressId: progress.id,
        sourceType: "STUDY_SESSION",
        sourceId: id,
        eventType: "SOURCE",
        deltaValue: minutes,
        idempotencyKey: `${activeChallenge.id}:${progress.id}:STUDY_SESSION:${id}:seed`,
        occurredAt: sourceSession.endedAt!,
      },
    });
  }

  const completedStart = daysAgo(4);
  const completedEnd = daysAgo(1);
  const completedChallenge = await prisma.challenge.upsert({
    where: { shareToken: "seed-completed-challenge-2026" },
    update: {
      creatorId: mariam.id,
      opponentId: youssef.id,
      subjectId: anatomy.id,
      subjectKey: "anatomy",
      subjectLabel: "Anatomy",
      type: "SUBJECT_TASK_COUNT",
      targetValue: 2,
      resolutionType: "TARGET_FIRST",
      startsAt: completedStart,
      endsAt: completedEnd,
      status: "COMPLETED",
      acceptedAt: completedStart,
      resolvedAt: hoursAgo(60),
      winnerId: mariam.id,
      shareEnabled: true,
    },
    create: {
      creatorId: mariam.id,
      opponentId: youssef.id,
      subjectId: anatomy.id,
      subjectKey: "anatomy",
      subjectLabel: "Anatomy",
      type: "SUBJECT_TASK_COUNT",
      targetValue: 2,
      resolutionType: "TARGET_FIRST",
      startsAt: completedStart,
      endsAt: completedEnd,
      status: "COMPLETED",
      acceptedAt: completedStart,
      resolvedAt: hoursAgo(60),
      winnerId: mariam.id,
      shareToken: "seed-completed-challenge-2026",
      shareEnabled: true,
    },
  });
  for (const [userId, value, reachedAt] of [
    [mariam.id, 2, hoursAgo(60)],
    [youssef.id, 1, null],
  ] as const)
    await prisma.challengeProgress.upsert({
      where: { challengeId_userId: { challengeId: completedChallenge.id, userId } },
      update: { currentValue: value, finalValue: value, targetReachedAt: reachedAt },
      create: {
        challengeId: completedChallenge.id,
        userId,
        currentValue: value,
        finalValue: value,
        targetReachedAt: reachedAt,
      },
    });

  const completedTaskIds = [
    "seed-phase9-task-mariam-1",
    "seed-phase9-task-mariam-2",
    "seed-phase9-task-youssef-1",
  ];
  await prisma.challengeProgressEvent.deleteMany({
    where: {
      challengeId: completedChallenge.id,
      sourceType: "TASK",
      sourceId: { in: completedTaskIds },
    },
  });
  for (const taskId of completedTaskIds) {
    const sourceTask = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    const progress = await prisma.challengeProgress.findUniqueOrThrow({
      where: {
        challengeId_userId: { challengeId: completedChallenge.id, userId: sourceTask.userId },
      },
    });
    await prisma.challengeProgressEvent.create({
      data: {
        challengeId: completedChallenge.id,
        progressId: progress.id,
        sourceType: "TASK",
        sourceId: sourceTask.id,
        eventType: "SOURCE",
        deltaValue: 1,
        idempotencyKey: `${completedChallenge.id}:${progress.id}:TASK:${sourceTask.id}:seed`,
        occurredAt: sourceTask.completedAt!,
      },
    });
  }

  const pendingChallenge = await prisma.challenge.upsert({
    where: { shareToken: "seed-pending-challenge-2026" },
    update: {
      creatorId: nour.id,
      opponentId: mariam.id,
      type: "TASK_COUNT",
      targetValue: 6,
      resolutionType: "TARGET_FIRST",
      startsAt: now,
      endsAt: new Date(now.getTime() + 5 * 86400000),
      status: "PENDING",
      acceptedAt: null,
      resolvedAt: null,
      winnerId: null,
      shareEnabled: false,
    },
    create: {
      creatorId: nour.id,
      opponentId: mariam.id,
      type: "TASK_COUNT",
      targetValue: 6,
      resolutionType: "TARGET_FIRST",
      startsAt: now,
      endsAt: new Date(now.getTime() + 5 * 86400000),
      status: "PENDING",
      shareToken: "seed-pending-challenge-2026",
    },
  });
  for (const userId of [nour.id, mariam.id])
    await prisma.challengeProgress.upsert({
      where: { challengeId_userId: { challengeId: pendingChallenge.id, userId } },
      update: { currentValue: 0, finalValue: null, targetReachedAt: null },
      create: { challengeId: pendingChallenge.id, userId },
    });

  const badgeData = [
    [
      "CHALLENGE_FINISHER",
      "Challenge finisher",
      "Completed an accepted one-to-one challenge.",
      "flag",
    ],
    [
      "CHALLENGE_WINNER",
      "Challenge milestone",
      "Finished a challenge with the leading eligible total.",
      "medal",
    ],
    ["TARGET_REACHED", "Target reached", "Reached the agreed challenge target.", "target"],
    [
      "CONSISTENT_CHALLENGER",
      "Steady challenger",
      "Completed five accepted one-to-one challenges.",
      "trend-up",
    ],
  ] as const;
  const badges = new Map<string, string>();
  for (const [key, name, description, iconKey] of badgeData) {
    const criteria =
      key === "CHALLENGE_FINISHER"
        ? { completedChallenges: 1 }
        : key === "CHALLENGE_WINNER"
          ? { wins: 1 }
          : key === "TARGET_REACHED"
            ? { reachedTarget: true }
            : { completedChallenges: 5 };
    const badge = await prisma.badgeDefinition.upsert({
      where: { key },
      update: { name, description, iconKey, criteria },
      create: { key, name, description, iconKey, criteria },
    });
    badges.set(key, badge.id);
  }
  for (const [userId, badgeKey] of [
    [mariam.id, "CHALLENGE_FINISHER"],
    [mariam.id, "CHALLENGE_WINNER"],
    [mariam.id, "TARGET_REACHED"],
    [youssef.id, "CHALLENGE_FINISHER"],
  ] as const) {
    const badgeId = badges.get(badgeKey)!;
    await prisma.userBadge.upsert({
      where: { awardKey: `${userId}:${badgeKey}:${completedChallenge.id}` },
      update: { badgeId, challengeId: completedChallenge.id },
      create: {
        awardKey: `${userId}:${badgeKey}:${completedChallenge.id}`,
        userId,
        badgeId,
        challengeId: completedChallenge.id,
      },
    });
  }
  await prisma.goal.create({
    data: {
      userId: mariam.id,
      subjectId: anatomy.id,
      title: "Finish upper limb revision",
      metric: "STUDY_MINUTES",
      targetValue: 600,
      period: "WEEKLY",
      startsAt: daysAgo(1),
      deadline: new Date(now.getTime() + 6 * 86400000),
    },
  });
  const recapJob = await prisma.aIJob.upsert({
    where: { jobKey: "seed-phase10-weekly-recap" },
    update: {
      status: "COMPLETED",
      attempts: 1,
      completedAt: now,
      errorCode: null,
    },
    create: {
      userId: mariam.id,
      jobKey: "seed-phase10-weekly-recap",
      type: "WEEKLY_RECAP",
      status: "COMPLETED",
      inputHash: "seed-phase10-weekly-recap-input",
      attempts: 1,
      model: "openai/gpt-oss-120b",
      promptVersion: "phase10-v1",
      startedAt: now,
      completedAt: now,
    },
  });
  await prisma.aIInsight.upsert({
    where: { aiJobId: recapJob.id },
    update: {
      title: "A steady week",
      content:
        "Your evening sessions were consistent. Keep tomorrow lighter after the longer anatomy block.",
      dismissedAt: null,
      purgeAt: new Date(now.getTime() + 30 * 86400000),
    },
    create: {
      userId: mariam.id,
      aiJobId: recapJob.id,
      type: "WEEKLY_RECAP",
      title: "A steady week",
      content:
        "Your evening sessions were consistent. Keep tomorrow lighter after the longer anatomy block.",
      supportingData: {
        detectorVersion: "phase10-signals-v1",
        confidence: "strong",
        attribution: "aggregate_personal_data",
        facts: { sessions: 10, timeWindow: "evening" },
      },
      model: "openai/gpt-oss-120b",
      purgeAt: new Date(now.getTime() + 30 * 86400000),
    },
  });
  await prisma.serviceUsageLog.upsert({
    where: { id: "seed-phase10-usage-recap" },
    update: {
      userId: mariam.id,
      aiJobId: recapJob.id,
      units: 240,
      inputUnits: 170,
      outputUnits: 70,
    },
    create: {
      id: "seed-phase10-usage-recap",
      userId: mariam.id,
      aiJobId: recapJob.id,
      service: "groq",
      operation: "scheduled_weekly_recap",
      model: "openai/gpt-oss-120b",
      units: 240,
      inputUnits: 170,
      outputUnits: 70,
      metadata: { promptVersion: "phase10-v1", seed: true },
    },
  });
  const examJob = await prisma.aIJob.upsert({
    where: { jobKey: "seed-phase10-exam-plan" },
    update: { status: "COMPLETED", attempts: 1, completedAt: now, errorCode: null },
    create: {
      userId: mariam.id,
      jobKey: "seed-phase10-exam-plan",
      type: "EXAM_PLAN",
      status: "COMPLETED",
      inputHash: "seed-phase10-exam-plan-input",
      attempts: 1,
      model: "openai/gpt-oss-120b",
      promptVersion: "phase10-v1",
      startedAt: now,
      completedAt: now,
    },
  });
  const existingExamPlan = await prisma.examPlan.findFirst({
    where: { userId: mariam.id, aiJobId: examJob.id },
    select: { id: true },
  });
  const examPlan = existingExamPlan
    ? await prisma.examPlan.update({
        where: { id: existingExamPlan.id },
        data: {
          title: "Upper limb exam plan",
          overview: "Short review blocks with a final recall pass.",
          examAt: new Date(now.getTime() + 14 * 86400000),
          syllabusText: "Brachial plexus, shoulder, arm, forearm, hand, clinical correlations.",
          status: "PARTIALLY_ACCEPTED",
          contextPurgeAt: new Date(now.getTime() + 30 * 86400000),
          rejectedAt: null,
        },
      })
    : await prisma.examPlan.create({
        data: {
          userId: mariam.id,
          aiJobId: examJob.id,
          inputHash: "seed-phase10-exam-plan-input",
          title: "Upper limb exam plan",
          overview: "Short review blocks with a final recall pass.",
          examAt: new Date(now.getTime() + 14 * 86400000),
          syllabusText: "Brachial plexus, shoulder, arm, forearm, hand, clinical correlations.",
          status: "PARTIALLY_ACCEPTED",
          locale: "EN",
          model: "openai/gpt-oss-120b",
          promptVersion: "phase10-v1",
          contextPurgeAt: new Date(now.getTime() + 30 * 86400000),
        },
      });
  const acceptedPlanTask = await prisma.task.upsert({
    where: { id: "seed-phase10-plan-task" },
    update: {
      userId: mariam.id,
      subjectId: anatomy.id,
      title: "Map the brachial plexus",
      notes: "Created from the Phase 10 exam-plan proposal.",
      dueAt: new Date(now.getTime() + 3 * 86400000),
      estimatedMinutes: 45,
      deletedAt: null,
    },
    create: {
      id: "seed-phase10-plan-task",
      userId: mariam.id,
      subjectId: anatomy.id,
      title: "Map the brachial plexus",
      notes: "Created from the Phase 10 exam-plan proposal.",
      dueAt: new Date(now.getTime() + 3 * 86400000),
      estimatedMinutes: 45,
    },
  });
  const planItems = [
    {
      id: "seed-phase10-plan-item-accepted",
      title: "Map the brachial plexus",
      notes: "Draw it from memory, then check the weak branches.",
      plannedDate: new Date(now.getTime() + 3 * 86400000),
      estimatedMinutes: 45,
      sortOrder: 0,
      accepted: true,
      acceptedAt: now,
      createdTaskId: acceptedPlanTask.id,
    },
    {
      id: "seed-phase10-plan-item-proposed",
      title: "Upper limb clinical correlations",
      notes: "Review lesion patterns and two short cases.",
      plannedDate: new Date(now.getTime() + 6 * 86400000),
      estimatedMinutes: 60,
      sortOrder: 1,
      accepted: false,
      acceptedAt: null,
      createdTaskId: null,
    },
  ] as const;
  for (const item of planItems)
    await prisma.examPlanItem.upsert({
      where: { id: item.id },
      update: {
        examPlanId: examPlan.id,
        subjectId: anatomy.id,
        ...item,
        rejectedAt: null,
      },
      create: {
        examPlanId: examPlan.id,
        subjectId: anatomy.id,
        ...item,
      },
    });
  void room;
  void activeChallenge;
  void completedChallenge;
  void pendingChallenge;
  void friendship;
  void accountability;
  console.log("Seeded Alex Study. Demo login: MED-2026-001 / AlexStudy2026!");
}

main().finally(() => prisma.$disconnect());
