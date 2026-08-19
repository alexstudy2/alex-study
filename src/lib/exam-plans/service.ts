import "server-only";

import { randomUUID } from "node:crypto";
import { addDays, subMinutes } from "date-fns";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { GROQ_MODEL } from "@/lib/ai/groq";
import { hashAIInput, makeAIJobKey, runTrackedAIJob } from "@/lib/ai/jobs";
import { AI_PROMPT_VERSION, AI_RETENTION_DAYS } from "@/lib/ai/policy";
import { generateExamPlanProposal } from "./ai";
import {
  MAX_PLAN_ITEMS,
  cairoDateKey,
  deriveExamPlanStatus,
  examWindowError,
  plannedDateToUtc,
  proposalDatesAreValid,
  type ExamPlanGenerateInput,
  type ExamPlanPatchInput,
} from "./validation";

export const examPlanSelect = {
  id: true,
  title: true,
  overview: true,
  examAt: true,
  status: true,
  locale: true,
  model: true,
  promptVersion: true,
  questionStrategy: true,
  studyMode: true,
  dailyCapacityMinutes: true,
  /** Non-null once the proposal has been published to the Plan Forum. Drives the header buttons. */
  studyPlanId: true,
  contextPurgeAt: true,
  contextPurgedAt: true,
  acceptedAt: true,
  rejectedAt: true,
  createdAt: true,
  updatedAt: true,
  items: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      notes: true,
      kind: true,
      plannedDate: true,
      estimatedMinutes: true,
      sortOrder: true,
      accepted: true,
      acceptedAt: true,
      rejectedAt: true,
      subject: { select: { id: true, name: true, colorToken: true } },
      createdTask: { select: { id: true, title: true, status: true } },
    },
  },
} satisfies Prisma.ExamPlanSelect;

export class ExamPlanError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly fields?: unknown,
  ) {
    super(message);
  }
}

function normalizedName(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function generationBucket(now: Date) {
  return Math.floor(now.getTime() / (15 * 60_000));
}

export type ExamPlanGenerationResult =
  | { ok: true; cached: boolean; plan: NonNullable<Awaited<ReturnType<typeof getExamPlan>>> }
  | { ok: false; error: string; status: 403 | 409 | 429 | 503 };

export async function getExamPlan(userId: string, planId: string) {
  return prisma.examPlan.findFirst({
    where: { id: planId, userId },
    select: examPlanSelect,
  });
}

export async function generateExamPlan(
  userId: string,
  locale: "en" | "ar",
  input: ExamPlanGenerateInput,
  now = new Date(),
): Promise<ExamPlanGenerationResult> {
  const examAt = new Date(input.examAt);
  const windowError = examWindowError(examAt, now);
  if (windowError) return { ok: false, error: windowError, status: 409 };
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiNudgesEnabled: true },
  });
  if (!profile?.aiNudgesEnabled) return { ok: false, error: "ai_disabled", status: 403 };
  const subjects = await prisma.subject.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, normalizedName: true },
    orderBy: { name: "asc" },
  });
  const inputHash = hashAIInput({
    title: input.title,
    examAt: examAt.toISOString(),
    syllabusText: input.syllabusText,
    /* In the hash, not just the metadata: the same topics asked for as revision instead of study,
       or with the other question rhythm, are a different plan -- and without these the 15-minute
       re-use cache below would hand back the plan the student just decided against. */
    questionStrategy: input.questionStrategy,
    studyMode: input.studyMode,
    dailyCapacityMinutes: input.dailyCapacityMinutes,
    restDays: input.restDays,
    locale,
    subjects: subjects.map((subject) => subject.normalizedName),
  });
  const recent = await prisma.examPlan.findFirst({
    where: {
      userId,
      inputHash,
      createdAt: { gte: subMinutes(now, 15) },
      status: { not: "REJECTED" },
    },
    select: examPlanSelect,
    orderBy: { createdAt: "desc" },
  });
  if (recent) return { ok: true, cached: true, plan: recent };
  const tracked = await runTrackedAIJob({
    userId,
    type: "EXAM_PLAN",
    operation: "exam_plan_generate",
    inputHash,
    jobKey: makeAIJobKey("EXAM_PLAN", { userId, inputHash, bucket: generationBucket(now) }),
    metadata: {
      examAt: examAt.toISOString(),
      syllabusCharacters: input.syllabusText.length,
      topicCount: input.topics.length,
      questionStrategy: input.questionStrategy,
      studyMode: input.studyMode,
      dailyCapacityMinutes: input.dailyCapacityMinutes,
      subjectCount: subjects.length,
    },
    now,
    run: async ({ jobId, recordUsage }) => {
      const proposal = await generateExamPlanProposal(
        {
          title: input.title,
          examAt,
          syllabusText: input.syllabusText,
          questionStrategy: input.questionStrategy,
          studyMode: input.studyMode,
          dailyCapacityMinutes: input.dailyCapacityMinutes,
          restDays: input.restDays,
          locale,
          subjects,
          now,
        },
        recordUsage,
      );
      const subjectsByName = new Map(
        subjects.map((subject) => [normalizedName(subject.name), subject.id]),
      );
      return prisma.examPlan.create({
        data: {
          userId,
          aiJobId: jobId,
          inputHash,
          title: input.title,
          overview: proposal.overview,
          examAt,
          syllabusText: input.syllabusText,
          questionStrategy: input.questionStrategy,
          studyMode: input.studyMode,
          dailyCapacityMinutes: input.dailyCapacityMinutes,
          status: "PROPOSED",
          locale: locale === "ar" ? "AR" : "EN",
          model: GROQ_MODEL,
          promptVersion: AI_PROMPT_VERSION,
          contextPurgeAt: addDays(now, AI_RETENTION_DAYS),
          items: {
            create: proposal.items.map((item, sortOrder) => ({
              title: item.title,
              notes: item.notes,
              kind: item.kind,
              subjectId: item.subjectName
                ? (subjectsByName.get(normalizedName(item.subjectName)) ?? null)
                : null,
              plannedDate: plannedDateToUtc(item.plannedDate),
              estimatedMinutes: item.estimatedMinutes,
              sortOrder,
            })),
          },
        },
        select: examPlanSelect,
      });
    },
  });
  if (!tracked.ok) return { ok: false, error: tracked.error, status: tracked.status };
  if (!tracked.cached) return { ok: true, cached: false, plan: tracked.value };
  const cached = await prisma.examPlan.findFirst({
    where: { userId, aiJobId: tracked.jobId },
    select: examPlanSelect,
  });
  if (!cached) return { ok: false, error: "ai_in_progress", status: 409 };
  return { ok: true, cached: true, plan: cached };
}

async function validateSubjects(userId: string, subjectIds: Array<string | null>) {
  const unique = [...new Set(subjectIds.filter((value): value is string => Boolean(value)))];
  if (!unique.length) return;
  const count = await prisma.subject.count({
    where: { id: { in: unique }, userId, archivedAt: null },
  });
  if (count !== unique.length)
    throw new ExamPlanError("invalid_subject", 400, { subjectId: ["Unknown subject"] });
}

export async function updateExamPlan(
  userId: string,
  planId: string,
  input: ExamPlanPatchInput,
  now = new Date(),
) {
  const existing = await prisma.examPlan.findFirst({
    where: { id: planId, userId },
    include: { items: true },
  });
  if (!existing) throw new ExamPlanError("not_found", 404);
  if (existing.rejectedAt || existing.status === "REJECTED" || existing.status === "ACCEPTED")
    throw new ExamPlanError("plan_locked", 409);
  const examAt = input.examAt ? new Date(input.examAt) : existing.examAt;
  if (input.examAt) {
    if (existing.items.some((item) => item.accepted || item.createdTaskId))
      throw new ExamPlanError("exam_date_locked", 409);
    const windowError = examWindowError(examAt, now);
    if (windowError) throw new ExamPlanError(windowError, 409);
  }
  await validateSubjects(userId, input.items?.map((item) => item.subjectId) ?? []);
  const existingById = new Map(existing.items.map((item) => [item.id, item]));
  const updateIds = input.items?.flatMap((item) => (item.id ? [item.id] : [])) ?? [];
  const removeIds = input.removeItemIds ?? [];
  if (updateIds.some((id) => removeIds.includes(id)))
    throw new ExamPlanError("conflicting_item_change", 400);
  for (const id of [...updateIds, ...removeIds]) {
    const item = existingById.get(id);
    if (!item) throw new ExamPlanError("item_not_found", 404);
    if (item.accepted || item.createdTaskId || item.rejectedAt)
      throw new ExamPlanError("accepted_item_locked", 409);
  }
  const changedDates = new Map(
    input.items?.flatMap((item) => (item.id ? [[item.id, item.plannedDate]] : [])),
  );
  const resultingDates = [
    ...existing.items.flatMap((item) =>
      removeIds.includes(item.id)
        ? []
        : [{ plannedDate: changedDates.get(item.id) ?? cairoDateKey(item.plannedDate) }],
    ),
    ...(input.items?.flatMap((item) => (item.id ? [] : [{ plannedDate: item.plannedDate }])) ?? []),
  ];
  if ((input.examAt || input.items) && !proposalDatesAreValid(resultingDates, examAt, now))
    throw new ExamPlanError("invalid_item_date", 400, {
      plannedDate: ["Study dates must be between today and the exam."],
    });
  const newItems = input.items?.filter((item) => !item.id).length ?? 0;
  const resultingCount = existing.items.length - removeIds.length + newItems;
  if (resultingCount < 1 || resultingCount > MAX_PLAN_ITEMS)
    throw new ExamPlanError("invalid_item_count", 400);

  await prisma.$transaction(async (tx) => {
    if (removeIds.length)
      await tx.examPlanItem.deleteMany({
        where: {
          id: { in: removeIds },
          examPlanId: planId,
          accepted: false,
          createdTaskId: null,
        },
      });
    for (const item of input.items ?? []) {
      const data = {
        title: item.title,
        notes: item.notes || null,
        kind: item.kind,
        subjectId: item.subjectId,
        plannedDate: plannedDateToUtc(item.plannedDate),
        estimatedMinutes: item.estimatedMinutes,
        sortOrder: item.sortOrder,
      };
      if (item.id) await tx.examPlanItem.update({ where: { id: item.id }, data });
      else await tx.examPlanItem.create({ data: { examPlanId: planId, ...data } });
    }
    const counts = await tx.examPlanItem.groupBy({
      by: ["accepted"],
      where: { examPlanId: planId },
      _count: { _all: true },
    });
    const totalItems = counts.reduce((total, row) => total + row._count._all, 0);
    const acceptedItems = counts.find((row) => row.accepted)?._count._all ?? 0;
    const status = deriveExamPlanStatus({ totalItems, acceptedItems, closed: false });
    await tx.examPlan.update({
      where: { id: planId },
      data: {
        title: input.title,
        overview: input.overview,
        examAt: input.examAt ? examAt : undefined,
        status,
        acceptedAt: status === "ACCEPTED" ? now : undefined,
      },
    });
  });
  return getExamPlan(userId, planId);
}

export async function acceptExamPlanItems(
  userId: string,
  planId: string,
  itemIds: string[],
  now = new Date(),
) {
  const plan = await prisma.examPlan.findFirst({
    where: { id: planId, userId },
    include: { items: { where: { id: { in: itemIds } }, orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) throw new ExamPlanError("not_found", 404);
  if (plan.status === "REJECTED" || plan.rejectedAt) throw new ExamPlanError("plan_locked", 409);
  if (plan.items.length !== itemIds.length) throw new ExamPlanError("item_not_found", 404);
  if (plan.items.some((item) => item.rejectedAt))
    throw new ExamPlanError("rejected_item_locked", 409);

  const result = await prisma.$transaction(
    async (tx) => {
      const max = await tx.task.aggregate({
        where: { userId, parentTaskId: null, deletedAt: null },
        _max: { sortOrder: true },
      });
      let sortOrder = (max._max.sortOrder ?? -1) + 1;
      const createdTaskIds: string[] = [];
      const existingTaskIds: string[] = [];
      for (const item of plan.items) {
        if (item.createdTaskId) {
          existingTaskIds.push(item.createdTaskId);
          continue;
        }
        const reserved = await tx.examPlanItem.updateMany({
          where: {
            id: item.id,
            examPlanId: planId,
            accepted: false,
            createdTaskId: null,
            rejectedAt: null,
          },
          data: { accepted: true, acceptedAt: now },
        });
        if (!reserved.count) continue;
        const taskId = randomUUID();
        await tx.task.create({
          data: {
            id: taskId,
            userId,
            subjectId: item.subjectId,
            title: item.title,
            notes: item.notes,
            priority: "MEDIUM",
            status: "TODO",
            dueAt: item.plannedDate,
            estimatedMinutes: item.estimatedMinutes,
            sortOrder,
          },
        });
        await tx.examPlanItem.update({
          where: { id: item.id },
          data: { createdTaskId: taskId },
        });
        sortOrder += 1;
        createdTaskIds.push(taskId);
      }
      const [totalItems, acceptedItems] = await Promise.all([
        tx.examPlanItem.count({ where: { examPlanId: planId, rejectedAt: null } }),
        tx.examPlanItem.count({ where: { examPlanId: planId, accepted: true } }),
      ]);
      const status = deriveExamPlanStatus({ totalItems, acceptedItems, closed: false });
      await tx.examPlan.update({
        where: { id: planId },
        data: { status, acceptedAt: status === "ACCEPTED" ? now : null },
      });
      return { createdTaskIds, existingTaskIds, status };
    },
    { isolationLevel: "Serializable" },
  );
  return { ...result, plan: await getExamPlan(userId, planId) };
}

export async function rejectExamPlan(userId: string, planId: string, now = new Date()) {
  const existing = await prisma.examPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, status: true, rejectedAt: true },
  });
  if (!existing) throw new ExamPlanError("not_found", 404);
  if (existing.status === "ACCEPTED") throw new ExamPlanError("plan_locked", 409);
  if (existing.rejectedAt) return getExamPlan(userId, planId);
  await prisma.$transaction(async (tx) => {
    await tx.examPlanItem.updateMany({
      where: { examPlanId: planId, accepted: false },
      data: { rejectedAt: now },
    });
    const acceptedItems = await tx.examPlanItem.count({
      where: { examPlanId: planId, accepted: true },
    });
    await tx.examPlan.update({
      where: { id: planId },
      data: {
        status: acceptedItems ? "PARTIALLY_ACCEPTED" : "REJECTED",
        rejectedAt: now,
      },
    });
  });
  return getExamPlan(userId, planId);
}
