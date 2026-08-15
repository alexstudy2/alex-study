import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { apiUser, conflict, invalid, unauthorized } from "@/lib/sessions/response";
import { timerRunInclude } from "@/lib/sessions/queries";
import { timerStartSchema } from "@/lib/sessions/validation";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const timer = await prisma.timerRun.findFirst({
    where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
    include: timerRunInclude,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ timer, serverNow: new Date().toISOString() });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = timerStartSchema.safeParse(await request.json().catch(() => null));
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
  if (task?.subjectId && data.subjectId && task.subjectId !== data.subjectId)
    return invalid({ subjectId: ["Task and subject do not match"] });
  const now = new Date();
  try {
    const timer = await prisma.$transaction(
      async (tx) => {
        const session =
          data.mode === "FOCUS"
            ? await tx.studySession.create({
                data: {
                  userId: user.id,
                  taskId: task?.id ?? null,
                  subjectId: data.subjectId ?? task?.subjectId ?? null,
                  startedAt: now,
                  plannedDurationSeconds: data.durationSeconds,
                  status: "ACTIVE",
                  source: "SOLO",
                },
              })
            : null;
        return tx.timerRun.create({
          data: {
            userId: user.id,
            sessionId: session?.id,
            taskId: task?.id ?? null,
            subjectId: data.subjectId ?? task?.subjectId ?? null,
            mode: data.mode,
            durationSeconds: data.durationSeconds,
            startedAt: now,
            segmentStartedAt: now,
          },
          include: timerRunInclude,
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );
    return Response.json({ timer, serverNow: now.toISOString() }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return conflict("active_timer_exists");
    throw error;
  }
}
