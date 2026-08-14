import { prisma } from "@/lib/db/prisma";
import { goalInclude } from "@/lib/goals/queries";
import { goalPatchSchema } from "@/lib/goals/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function GET(_: Request, context: { params: Promise<{ goalId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { goalId } = await context.params;
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: user.id },
    include: goalInclude,
  });
  return goal ? Response.json({ goal }) : notFound();
}

export async function PATCH(request: Request, context: { params: Promise<{ goalId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { goalId } = await context.params;
  const parsed = goalPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  if (!(await prisma.goal.findFirst({ where: { id: goalId, userId: user.id } }))) return notFound();
  if (
    parsed.data.subjectId &&
    !(await prisma.subject.findFirst({
      where: { id: parsed.data.subjectId, userId: user.id, archivedAt: null },
    }))
  )
    return invalid({ subjectId: ["Unknown subject"] });
  const goal = await prisma.goal.update({
    where: { id: goalId },
    data: {
      ...parsed.data,
      subjectId: parsed.data.subjectId || null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : undefined,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
    },
    include: goalInclude,
  });
  return Response.json({ goal });
}

export async function DELETE(_: Request, context: { params: Promise<{ goalId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { goalId } = await context.params;
  const result = await prisma.goal.deleteMany({ where: { id: goalId, userId: user.id } });
  return result.count ? Response.json({ ok: true }) : notFound();
}
