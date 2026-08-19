import { prisma } from "@/lib/db/prisma";
import { cairoDayStart } from "@/lib/plan-forum/dates";
import { authoredPlan, visiblePlan } from "@/lib/plan-forum/queries";
import { planPatchSchema } from "@/lib/plan-forum/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function GET(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  const plan = await visiblePlan(user, planId);
  return plan ? Response.json({ plan }) : notFound();
}

export async function PATCH(request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = planPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId } = await context.params;
  const existing = await authoredPlan(user.id, planId);
  if (!existing) return notFound();
  const { title, description, startDate, endDate, visibility } = parsed.data;

  const startsAt = startDate ? cairoDayStart(startDate) : existing.startDate;
  const endsAt = endDate ? cairoDayStart(endDate) : existing.endDate;

  /* Shrinking the period leaves notes on days the board no longer draws. Deleting them in the same
     transaction as the period change is the only outcome that stays honest: keeping them hides
     rows the author cannot reach or edit, and deleting them afterwards can half-apply. The count
     goes back in the response so the board can say what happened rather than just losing them. */
  const [removed, plan] = await prisma.$transaction([
    prisma.studyPlanItem.deleteMany({
      where: { planId, OR: [{ dayDate: { lt: startsAt } }, { dayDate: { gt: endsAt } }] },
    }),
    prisma.studyPlan.update({
      where: { id: planId },
      data: {
        ...(title === undefined ? {} : { title }),
        ...(description === undefined ? {} : { description: description || null }),
        ...(startDate ? { startDate: startsAt } : {}),
        ...(endDate ? { endDate: endsAt } : {}),
        ...(visibility
          ? {
              visibility,
              // Re-stamped on every share, so a plan goes to the class its author is in *now*.
              // Unsharing only clears sharedAt: the year it was last shared with is history worth
              // keeping, and the visibility flag alone decides who may read it.
              ...(visibility === "CLASS"
                ? { academicYear: user.academicYear, sharedAt: new Date() }
                : { sharedAt: null }),
            }
          : {}),
      },
      select: { id: true },
    }),
  ]);
  return Response.json({ plan, removedItems: removed.count });
}

export async function DELETE(_: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId } = await context.params;
  if (!(await authoredPlan(user.id, planId))) return notFound();
  // Items and bookmarks go with it: both relations are onDelete: Cascade.
  await prisma.studyPlan.delete({ where: { id: planId } });
  return Response.json({ ok: true });
}
