import { prisma } from "@/lib/db/prisma";
import { sessionInclude } from "@/lib/sessions/queries";
import { focusScore } from "@/lib/sessions/timer";
import { apiUser, invalid, unauthorized } from "@/lib/sessions/response";
import { manualSessionSchema } from "@/lib/sessions/validation";

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const limit = Math.min(
    100,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 30),
  );
  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: sessionInclude,
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return Response.json({ sessions });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = manualSessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  const [task, subject] = await Promise.all([
    data.taskId
      ? prisma.task.findFirst({ where: { id: data.taskId, userId: user.id, deletedAt: null } })
      : null,
    data.subjectId
      ? prisma.subject.findFirst({
          where: { id: data.subjectId, userId: user.id, archivedAt: null },
        })
      : null,
  ]);
  if (data.taskId && !task) return invalid({ taskId: ["Unknown task"] });
  if (data.subjectId && !subject) return invalid({ subjectId: ["Unknown subject"] });
  const startedAt = new Date(data.startedAt);
  const endedAt = new Date(data.endedAt);
  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      taskId: task?.id ?? null,
      subjectId: data.subjectId ?? task?.subjectId ?? null,
      startedAt,
      endedAt,
      durationSeconds,
      plannedDurationSeconds: data.plannedDurationSeconds,
      distractionCount: data.distractionCount,
      focusScore: focusScore(durationSeconds, data.plannedDurationSeconds, data.distractionCount),
      reflection: data.reflection || null,
      source: "MANUAL",
      status: "COMPLETED",
    },
    include: sessionInclude,
  });
  return Response.json({ session }, { status: 201 });
}
