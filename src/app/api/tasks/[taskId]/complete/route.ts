import { prisma } from "@/lib/db/prisma";
import { nextRecurrenceDate } from "@/lib/tasks/dates";
import { apiUser, notFound, unauthorized } from "@/lib/tasks/response";
import { recurrenceSchema } from "@/lib/tasks/validation";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";

export async function POST(_: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { taskId } = await ctx.params;
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id, deletedAt: null },
    include: { subtasks: { where: { deletedAt: null } } },
  });
  if (!existing) return notFound();
  if (existing.status === "COMPLETED" && existing.completedAt)
    return Response.json({ task: existing });
  const rule = recurrenceSchema.safeParse(existing.recurrenceRule);
  const completedAt = new Date();
  const task = await prisma.$transaction(async (tx) => {
    const completed = await tx.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt,
        subtasks: {
          updateMany: {
            where: { deletedAt: null },
            data: { status: "COMPLETED", completedAt },
          },
        },
      },
    });
    if (rule.success && existing.dueAt) {
      const recurrenceDate = nextRecurrenceDate(existing.dueAt, rule.data);
      await tx.task.upsert({
        where: {
          recurrenceSourceId_recurrenceDate: {
            recurrenceSourceId: existing.recurrenceSourceId ?? existing.id,
            recurrenceDate,
          },
        },
        update: {},
        create: {
          userId: existing.userId,
          subjectId: existing.subjectId,
          title: existing.title,
          notes: existing.notes,
          priority: existing.priority,
          dueAt: recurrenceDate,
          estimatedMinutes: existing.estimatedMinutes,
          sortOrder: existing.sortOrder,
          recurrenceRule: existing.recurrenceRule ?? undefined,
          recurrenceSourceId: existing.recurrenceSourceId ?? existing.id,
          recurrenceDate,
          subtasks: {
            create: existing.subtasks.map((subtask) => ({
              userId: existing.userId,
              subjectId: subtask.subjectId,
              title: subtask.title,
              notes: subtask.notes,
              priority: subtask.priority,
              estimatedMinutes: subtask.estimatedMinutes,
              sortOrder: subtask.sortOrder,
            })),
          },
        },
      });
    }
    return completed;
  });
  await recalculateChallengesForUser(user.id);
  return Response.json({ task });
}
