import { prisma } from "@/lib/db/prisma";
import { activeSeconds, focusScore } from "@/lib/sessions/timer";
import { timerRunInclude } from "@/lib/sessions/queries";
import { apiUser, conflict, invalid, notFound, unauthorized } from "@/lib/sessions/response";
import { timerActionSchema } from "@/lib/sessions/validation";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";

const actions = ["pause", "resume", "complete", "cancel"] as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ timerId: string; action: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { timerId, action } = await context.params;
  if (!actions.includes(action as (typeof actions)[number])) return notFound();
  const parsed = timerActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const run = await prisma.timerRun.findFirst({ where: { id: timerId, userId: user.id } });
  if (!run) return notFound();
  if (run.version !== parsed.data.version) return conflict("stale_timer_version");
  const now = new Date();
  const elapsed = activeSeconds(run, now);
  const nextVersion = run.version + 1;
  if (action === "pause") {
    if (run.status !== "RUNNING") return conflict("timer_not_running");
    const timer = await prisma.timerRun.update({
      where: { id: run.id },
      data: {
        status: "PAUSED",
        accumulatedActiveSeconds: elapsed,
        segmentStartedAt: null,
        pausedAt: now,
        version: nextVersion,
      },
      include: timerRunInclude,
    });
    return Response.json({ timer, serverNow: now.toISOString() });
  }
  if (action === "resume") {
    if (run.status !== "PAUSED") return conflict("timer_not_paused");
    const timer = await prisma.timerRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", segmentStartedAt: now, pausedAt: null, version: nextVersion },
      include: timerRunInclude,
    });
    return Response.json({ timer, serverNow: now.toISOString() });
  }
  if (!["RUNNING", "PAUSED"].includes(run.status)) return conflict("timer_already_closed");
  if (action === "cancel") {
    const timer = await prisma.$transaction(async (tx) => {
      if (run.sessionId)
        await tx.studySession.update({
          where: { id: run.sessionId },
          data: { status: "ABANDONED", endedAt: now, durationSeconds: elapsed },
        });
      return tx.timerRun.update({
        where: { id: run.id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          accumulatedActiveSeconds: elapsed,
          segmentStartedAt: null,
          version: nextVersion,
        },
        include: timerRunInclude,
      });
    });
    return Response.json({ timer, serverNow: now.toISOString() });
  }
  const timer = await prisma.$transaction(async (tx) => {
    if (run.sessionId) {
      const session = await tx.studySession.findFirst({
        where: { id: run.sessionId, userId: user.id },
      });
      if (!session) throw new Error("Timer session missing");
      await tx.studySession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          durationSeconds: elapsed,
          focusScore: focusScore(elapsed, session.plannedDurationSeconds, session.distractionCount),
          reflection: parsed.data.reflection || null,
        },
      });
    }
    return tx.timerRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: now,
        accumulatedActiveSeconds: elapsed,
        segmentStartedAt: null,
        version: nextVersion,
      },
      include: timerRunInclude,
    });
  });
  if (run.sessionId) await recalculateChallengesForUser(user.id);
  return Response.json({ timer, serverNow: now.toISOString() });
}
