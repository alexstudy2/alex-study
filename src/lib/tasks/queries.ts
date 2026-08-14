import type { Prisma } from "@prisma/client";
import { getTaskDateWindow, type TaskDateFilter } from "./dates";

export function buildTaskWhere(
  userId: string,
  filter: TaskDateFilter,
  now = new Date(),
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { userId, deletedAt: null, parentTaskId: null };
  if (filter === "completed") return { ...where, status: "COMPLETED" };
  where.status = { notIn: ["COMPLETED", "CANCELLED"] };
  const window = getTaskDateWindow(filter, now);
  if (window) where.dueAt = window;
  return where;
}

export const taskInclude = {
  subject: true,
  subtasks: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" as const } },
};
