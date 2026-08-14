import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { buildTaskWhere, taskInclude } from "@/lib/tasks/queries";
import { taskInputSchema } from "@/lib/tasks/validation";
import type { TaskDateFilter } from "@/lib/tasks/dates";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const filter = new URL(request.url).searchParams.get("filter") ?? "all";
  if (!["all", "today", "week", "overdue", "completed"].includes(filter)) return invalid();
  const tasks = await prisma.task.findMany({
    where: buildTaskWhere(user.id, filter as TaskDateFilter),
    include: taskInclude,
    orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
  });
  return Response.json({ tasks });
}
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = taskInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  if (
    data.subjectId &&
    !(await prisma.subject.findFirst({
      where: { id: data.subjectId, userId: user.id, archivedAt: null },
    }))
  )
    return invalid({ subjectId: ["Unknown subject"] });
  if (
    data.parentTaskId &&
    !(await prisma.task.findFirst({
      where: { id: data.parentTaskId, userId: user.id, parentTaskId: null, deletedAt: null },
    }))
  )
    return invalid({ parentTaskId: ["Unknown parent task"] });
  const max = await prisma.task.aggregate({
    where: { userId: user.id, parentTaskId: data.parentTaskId ?? null, deletedAt: null },
    _max: { sortOrder: true },
  });
  const task = await prisma.task.create({
    data: {
      userId: user.id,
      ...data,
      notes: data.notes || null,
      subjectId: data.subjectId || null,
      parentTaskId: data.parentTaskId || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      recurrenceRule: data.recurrenceRule ?? undefined,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    include: taskInclude,
  });
  if (task.status === "COMPLETED") await recalculateChallengesForUser(user.id);
  return Response.json({ task }, { status: 201 });
}
