import { prisma } from "@/lib/db/prisma";
import { sessionInclude } from "@/lib/sessions/queries";
import { apiUser, notFound, unauthorized } from "@/lib/sessions/response";
import { invalid } from "@/lib/sessions/response";
import { sessionPatchSchema } from "@/lib/sessions/validation";
import { focusScore } from "@/lib/sessions/timer";

export async function GET(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { sessionId } = await context.params;
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: sessionInclude,
  });
  return session ? Response.json({ session }) : notFound();
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { sessionId } = await context.params;
  const existing = await prisma.studySession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return notFound();
  const parsed = sessionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const [task, subject] = await Promise.all([
    data.taskId
      ? prisma.task.findFirst({ where: { id: data.taskId, userId: user.id, deletedAt: null } })
      : null,
    data.subjectId
      ? prisma.subject.findFirst({ where: { id: data.subjectId, userId: user.id, archivedAt: null } })
      : null,
  ]);
  if (data.taskId && !task) return invalid({ taskId: ["Unknown task"] });
  if (data.subjectId && !subject) return invalid({ subjectId: ["Unknown subject"] });
  const startedAt = data.startedAt ? new Date(data.startedAt) : existing.startedAt;
  const endedAt = data.endedAt ? new Date(data.endedAt) : existing.endedAt;
  if (!endedAt || endedAt <= startedAt) return invalid({ endedAt: ["End time must be after start time"] });
  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  const plannedDurationSeconds = data.plannedDurationSeconds ?? existing.plannedDurationSeconds;
  const distractionCount = data.distractionCount ?? existing.distractionCount;
  const session = await prisma.studySession.update({
    where: { id: sessionId },
    data: {
      taskId: data.taskId === undefined ? existing.taskId : task?.id ?? null,
      subjectId:
        data.subjectId === undefined
          ? existing.subjectId
          : data.subjectId ?? task?.subjectId ?? null,
      startedAt,
      endedAt,
      durationSeconds,
      plannedDurationSeconds,
      distractionCount,
      reflection: data.reflection === undefined ? existing.reflection : data.reflection || null,
      focusScore: focusScore(durationSeconds, plannedDurationSeconds, distractionCount),
    },
    include: sessionInclude,
  });
  return Response.json({ session });
}

export async function DELETE(_: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { sessionId } = await context.params;
  const existing = await prisma.studySession.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!existing) return notFound();
  await prisma.$transaction([
    prisma.timerRun.updateMany({ where: { sessionId }, data: { sessionId: null } }),
    prisma.studySession.delete({ where: { id: sessionId } }),
  ]);
  return Response.json({ deleted: true });
}
