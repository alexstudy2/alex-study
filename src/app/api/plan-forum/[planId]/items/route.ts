import { prisma } from "@/lib/db/prisma";
import { cairoDayStart, isDayInPlan } from "@/lib/plan-forum/dates";
import { authoredPlan, MAX_ITEMS_PER_PLAN, resolveSubject } from "@/lib/plan-forum/queries";
import { planItemInputSchema } from "@/lib/plan-forum/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = planItemInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId } = await context.params;
  const plan = await authoredPlan(user.id, planId);
  if (!plan) return notFound();

  const { title, subjectLabel, dayDate } = parsed.data;
  // A note outside the period would exist with no sticky note to live on -- unreachable, and
  // undeletable from the board.
  if (!isDayInPlan(dayDate, plan.startDate, plan.endDate))
    return invalid({ dayDate: ["That day is outside the plan's period"] });

  const total = await prisma.studyPlanItem.count({ where: { planId } });
  if (total >= MAX_ITEMS_PER_PLAN)
    return invalid({ title: [`A plan holds at most ${MAX_ITEMS_PER_PLAN} tasks`] });

  const day = cairoDayStart(dayDate);
  const { subjectId, colorToken } = await resolveSubject(user.id, subjectLabel);
  const item = await prisma.studyPlanItem.create({
    data: {
      planId,
      dayDate: day,
      title,
      subjectLabel,
      subjectId,
      colorToken,
      // Appended to that day's stack. Counting is enough: notes are only ever added at the end.
      sortOrder: await prisma.studyPlanItem.count({ where: { planId, dayDate: day } }),
    },
    select: { id: true, dayDate: true, title: true, subjectLabel: true, colorToken: true },
  });
  // Touch the plan so it rises to the top of the author's shelf, which is ordered by updatedAt.
  await prisma.studyPlan.update({ where: { id: planId }, data: { updatedAt: new Date() } });
  return Response.json({ item: { ...item, dayDate } }, { status: 201 });
}
