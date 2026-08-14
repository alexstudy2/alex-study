import { prisma } from "@/lib/db/prisma";
import { activeSeconds } from "@/lib/sessions/timer";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
import { canControlTimer } from "@/lib/lobbies/permissions";
import { timerActionSchema } from "@/lib/sessions/validation";
export async function POST(r: Request, c: { params: Promise<{ roomId: string; action: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { roomId, action } = await c.params;
  if (!["pause", "resume", "complete", "cancel"].includes(action)) return notFound();
  const p = timerActionSchema.safeParse(await r.json().catch(() => null));
  if (!p.success) return invalid();
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  if (!member || !canControlTimer(member.role)) return unauthorized();
  const run = await prisma.timerRun.findFirst({
    where: { roomId, status: { in: ["RUNNING", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!run) return notFound();
  if (run.version !== p.data.version)
    return Response.json({ error: "stale_timer_version" }, { status: 409 });
  const now = new Date(),
    elapsed = activeSeconds(run, now),
    version = run.version + 1;
  const data =
    action === "pause" && run.status === "RUNNING"
      ? {
          status: "PAUSED" as const,
          accumulatedActiveSeconds: elapsed,
          segmentStartedAt: null,
          pausedAt: now,
          version,
        }
      : action === "resume" && run.status === "PAUSED"
        ? { status: "RUNNING" as const, segmentStartedAt: now, pausedAt: null, version }
        : action === "complete"
          ? {
              status: "COMPLETED" as const,
              accumulatedActiveSeconds: elapsed,
              segmentStartedAt: null,
              completedAt: now,
              version,
            }
          : action === "cancel"
            ? {
                status: "CANCELLED" as const,
                accumulatedActiveSeconds: elapsed,
                segmentStartedAt: null,
                cancelledAt: now,
                version,
              }
            : null;
  if (!data) return Response.json({ error: "invalid_timer_state" }, { status: 409 });
  return Response.json({
    timer: await prisma.timerRun.update({ where: { id: run.id }, data }),
    serverNow: now.toISOString(),
  });
}
