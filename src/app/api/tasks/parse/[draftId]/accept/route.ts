import { prisma } from "@/lib/db/prisma";
import { acceptDraftSchema } from "@/lib/tasks/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";
export async function POST(request: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { draftId } = await ctx.params;
  const edits = acceptDraftSchema.safeParse(await request.json().catch(() => ({})));
  if (!edits.success) return invalid(edits.error.flatten().fieldErrors);
  const draft = await prisma.taskDraft.findFirst({
    where: { id: draftId, userId: user.id, status: "PENDING", expiresAt: { gt: new Date() } },
  });
  if (!draft) return notFound();
  const task = await prisma.$transaction(async (tx) => {
    const max = await tx.task.aggregate({
      where: { userId: user.id, parentTaskId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    const data = {
      title: draft.title,
      notes: draft.notes,
      subjectId: draft.subjectId,
      priority: draft.priority,
      dueAt: draft.dueAt,
      estimatedMinutes: draft.estimatedMinutes,
      recurrenceRule: draft.recurrenceRule,
    };
    const created = await tx.task.create({
      data: {
        userId: user.id,
        ...data,
        ...edits.data,
        dueAt: edits.data.dueAt
          ? new Date(edits.data.dueAt)
          : edits.data.dueAt === null || edits.data.dueAt === ""
            ? null
            : draft.dueAt,
        recurrenceRule: edits.data.recurrenceRule ?? draft.recurrenceRule ?? undefined,
        completedAt: (edits.data.status ?? "TODO") === "COMPLETED" ? new Date() : null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    await tx.taskDraft.update({
      where: { id: draft.id },
      data: { status: "ACCEPTED", acceptedTaskId: created.id, decidedAt: new Date() },
    });
    return created;
  });
  if (task.status === "COMPLETED") await recalculateChallengesForUser(user.id);
  return Response.json({ task }, { status: 201 });
}
