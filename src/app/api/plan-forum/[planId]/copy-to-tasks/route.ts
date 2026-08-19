import { prisma } from "@/lib/db/prisma";
import { cairoDayAt9, cairoDayRange } from "@/lib/plan-forum/dates";
import { canViewPlan } from "@/lib/plan-forum/permissions";
import { resolveSubject } from "@/lib/plan-forum/queries";
import { copyToTasksSchema } from "@/lib/plan-forum/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

/**
 * The "Copy to tasks" box in the calendar's day drawer.
 *
 * Applying a plan to the calendar is a *view* -- switching source writes nothing. This is the one
 * place a plan becomes real work, and it is deliberately one day at a time and always initiated by
 * a press: a plan you are only reading should never be able to fill your task list.
 *
 * Tasks are created for the *caller*, not the author, and subjects are re-resolved against the
 * caller's own courses -- a classmate's "Anatomy" note lands on the reader's own Anatomy if they
 * have one, and as an uncategorised task if they do not.
 */
export async function POST(request: Request, context: { params: Promise<{ planId: string }> }) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = copyToTasksSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const { planId } = await context.params;
  const { dayDate } = parsed.data;

  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      authorId: true,
      visibility: true,
      academicYear: true,
      saves: { where: { userId: user.id }, select: { id: true }, take: 1 },
    },
  });
  if (!plan) return notFound();
  if (!canViewPlan(user, plan, plan.saves.length > 0)) return notFound();

  const day = cairoDayRange(dayDate);
  const items = await prisma.studyPlanItem.findMany({
    where: { planId, dayDate: { gte: day.start, lte: day.end } },
    select: { title: true, subjectLabel: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!items.length) return Response.json({ created: 0, skipped: 0 });

  /* Pressing the button twice must not double the day. Matching on title within the day is the
     check that survives a reload -- there is no per-item link back to a created task, and adding
     one would make a shared plan's items carry another reader's task ids. */
  const existing = new Set(
    (
      await prisma.task.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          dueAt: { gte: day.start, lte: day.end },
        },
        select: { title: true },
      })
    ).map((task) => task.title.trim().toLocaleLowerCase()),
  );

  const dueAt = cairoDayAt9(dayDate);
  let created = 0;
  let skipped = 0;
  for (const item of items) {
    if (existing.has(item.title.trim().toLocaleLowerCase())) {
      skipped += 1;
      continue;
    }
    const { subjectId } = await resolveSubject(user.id, item.subjectLabel);
    await prisma.task.create({
      data: { userId: user.id, title: item.title, subjectId, dueAt, status: "TODO" },
    });
    // Guards against a plan holding the same title twice on one day.
    existing.add(item.title.trim().toLocaleLowerCase());
    created += 1;
  }
  return Response.json({ created, skipped });
}
