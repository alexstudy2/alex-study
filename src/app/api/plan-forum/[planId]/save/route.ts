import { prisma } from "@/lib/db/prisma";
import { canViewPlan } from "@/lib/plan-forum/permissions";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

/**
 * Bookmarking somebody else's plan. A row, not a copy: their edits keep showing through, and
 * there is no duplicate to drift out of date.
 */
export async function POST(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    select: { id: true, authorId: true, visibility: true, academicYear: true },
  });
  if (!plan) return notFound();
  // Your own plans are already on your shelf; a self-save would show them twice.
  if (plan.authorId === user.id) return invalid({ planId: ["This is already your plan"] });
  if (!canViewPlan(user, plan, false)) return notFound();

  // Upsert rather than create: the button is idempotent, and @@unique([userId, planId]) would
  // otherwise turn a double-click into a 500.
  await prisma.studyPlanSave.upsert({
    where: { userId_planId: { userId: user.id, planId } },
    create: { userId: user.id, planId },
    update: {},
  });
  return Response.json({ saved: true }, { status: 201 });
}

export async function DELETE(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  await prisma.studyPlanSave.deleteMany({ where: { userId: user.id, planId } });
  return Response.json({ saved: false });
}
