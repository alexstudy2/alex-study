import { prisma } from "@/lib/db/prisma";
import { cairoDayStart, isDayInPlan } from "@/lib/plan-forum/dates";
import { authoredPlan, resolveSubject } from "@/lib/plan-forum/queries";
import { planItemPatchSchema } from "@/lib/plan-forum/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

type ItemContext = { params: Promise<{ planId: string; itemId: string }> };

/** Both handlers need the same two checks: the plan is mine, and the item is on that plan. */
async function ownedItem(userId: string, planId: string, itemId: string) {
  const plan = await authoredPlan(userId, planId);
  if (!plan) return null;
  const item = await prisma.studyPlanItem.findFirst({
    where: { id: itemId, planId },
    select: { id: true },
  });
  return item ? { plan, item } : null;
}

export async function PATCH(request: Request, context: ItemContext) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = planItemPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId, itemId } = await context.params;
  const owned = await ownedItem(user.id, planId, itemId);
  if (!owned) return notFound();

  const { title, subjectLabel, dayDate } = parsed.data;
  if (dayDate && !isDayInPlan(dayDate, owned.plan.startDate, owned.plan.endDate))
    return invalid({ dayDate: ["That day is outside the plan's period"] });
  // Re-resolved because the colour follows the label: renaming a note's subject to one of the
  // author's real courses should adopt that course's colour, not keep the hashed one.
  const resolved = subjectLabel ? await resolveSubject(user.id, subjectLabel) : null;

  const item = await prisma.studyPlanItem.update({
    where: { id: itemId },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(subjectLabel === undefined ? {} : { subjectLabel, ...resolved }),
      ...(dayDate ? { dayDate: cairoDayStart(dayDate) } : {}),
    },
    select: { id: true, title: true, subjectLabel: true, colorToken: true },
  });
  return Response.json({ item });
}

export async function DELETE(_: Request, context: ItemContext) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { planId, itemId } = await context.params;
  if (!(await ownedItem(user.id, planId, itemId))) return notFound();
  await prisma.studyPlanItem.delete({ where: { id: itemId } });
  return Response.json({ ok: true });
}
