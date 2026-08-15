import { prisma } from "@/lib/db/prisma";
import { apiUser, conflict, invalid, notFound, unauthorized } from "@/lib/sessions/response";
import { distractionSchema } from "@/lib/sessions/validation";

export async function POST(request: Request, context: { params: Promise<{ timerId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = distractionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { timerId } = await context.params;
  const run = await prisma.timerRun.findFirst({ where: { id: timerId, userId: user.id } });
  if (!run) return notFound();
  if (run.mode !== "FOCUS" || !run.sessionId || !["RUNNING", "PAUSED"].includes(run.status))
    return conflict("distraction_unavailable");
  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.sessionDistraction.create({
      data: { sessionId: run.sessionId!, note: parsed.data.note || null },
    });
    const session = await tx.studySession.update({
      where: { id: run.sessionId! },
      data: { distractionCount: { increment: 1 } },
      select: { distractionCount: true },
    });
    return { distraction: item, distractionCount: session.distractionCount };
  });
  return Response.json(result, { status: 201 });
}
