import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
import { taskInclude } from "@/lib/tasks/queries";
import { taskPatchSchema } from "@/lib/tasks/validation";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";

export async function GET(_: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { taskId } = await ctx.params;
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id, deletedAt: null },
    include: taskInclude,
  });
  return task ? Response.json({ task }) : notFound();
}
export async function PATCH(request: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { taskId } = await ctx.params;
  const parsed = taskPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const existing = await prisma.task.findFirst({
    where: { id: taskId, userId: user.id, deletedAt: null },
    select: { completedAt: true },
  });
  if (!existing) return notFound();
  const data = parsed.data;
  if (
    data.subjectId &&
    !(await prisma.subject.findFirst({
      where: { id: data.subjectId, userId: user.id, archivedAt: null },
    }))
  )
    return invalid({ subjectId: ["Unknown subject"] });
  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...data,
      notes: data.notes || null,
      subjectId: data.subjectId || null,
      dueAt: data.dueAt
        ? new Date(data.dueAt)
        : data.dueAt === null || data.dueAt === ""
          ? null
          : undefined,
      recurrenceRule: data.recurrenceRule === null ? Prisma.JsonNull : data.recurrenceRule,
      completedAt:
        data.status === "COMPLETED"
          ? (existing.completedAt ?? new Date())
          : data.status
            ? null
            : undefined,
    },
    include: taskInclude,
  });
  await recalculateChallengesForUser(user.id);
  return Response.json({ task });
}
export async function DELETE(_: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { taskId } = await ctx.params;
  const result = await prisma.task.updateMany({
    where: { id: taskId, userId: user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count) await recalculateChallengesForUser(user.id);
  return result.count ? Response.json({ ok: true }) : notFound();
}
