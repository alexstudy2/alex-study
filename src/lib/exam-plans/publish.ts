import "server-only";

import { prisma } from "@/lib/db/prisma";
import { planColorToken, safeColorToken } from "@/lib/plan-forum/colors";
import { cairoDayStart } from "@/lib/plan-forum/dates";
import { forumPeriodForItems } from "./days";
import { ExamPlanError } from "./service";
import { cairoDateKey } from "./validation";

/**
 * Publishing a finished proposal to the Plan Forum.
 *
 * This is the whole integration story in one function. A `StudyPlan` already knows how to be shared
 * with a year, drawn as sticky notes, overlaid on the calendar (`?source=plan&planId=`) and copied
 * into tasks a day at a time -- so an exam plan that becomes one inherits every bit of that instead
 * of growing its own copy. Nothing in `src/lib/plan-forum` learns that exam plans exist; the link
 * lives on `ExamPlan.studyPlanId`.
 *
 * Idempotent by design: publishing again updates the same forum plan, so a classmate's bookmark and
 * an existing share survive an edit-and-republish. That is why the items are deleted and rewritten
 * rather than the plan being recreated.
 */

/** Forum notes cap their own text at these lengths; an exam item may legitimately be longer. */
const FORUM_TITLE_MAX = 160;
const FORUM_LABEL_MAX = 60;

export async function publishExamPlanToForum(userId: string, planId: string) {
  const plan = await prisma.examPlan.findFirst({
    where: { id: planId, userId },
    select: {
      id: true,
      title: true,
      overview: true,
      examAt: true,
      studyPlanId: true,
      user: { select: { academicYear: true } },
      items: {
        // Rejected items are the ones the student struck out. They do not travel.
        where: { rejectedAt: null },
        orderBy: [{ plannedDate: "asc" }, { sortOrder: "asc" }],
        select: {
          title: true,
          plannedDate: true,
          subjectId: true,
          subject: { select: { name: true, colorToken: true } },
        },
      },
    },
  });
  if (!plan) throw new ExamPlanError("not_found", 404);

  const dayKeys = plan.items.map((item) => cairoDateKey(item.plannedDate));
  const { period, error } = forumPeriodForItems(dayKeys, cairoDateKey(plan.examAt));
  if (error) throw new ExamPlanError(error, 409);

  /*
   * Only the day *key* crosses over. Exam plan items are stored at 23:59 Cairo and forum notes at
   * Cairo midnight, so handing the instant across would drop every item onto the following day for
   * anyone reading from a negative offset -- and onto the day after the exam for the last one.
   */
  const perDay = new Map<string, number>();
  const notes = plan.items.map((item) => {
    const dayKey = cairoDateKey(item.plannedDate);
    const index = perDay.get(dayKey) ?? 0;
    perDay.set(dayKey, index + 1);
    const label = (item.subject?.name ?? plan.title).slice(0, FORUM_LABEL_MAX);
    return {
      dayDate: cairoDayStart(dayKey),
      title: item.title.slice(0, FORUM_TITLE_MAX),
      subjectLabel: label,
      subjectId: item.subjectId,
      colorToken: item.subject?.colorToken
        ? safeColorToken(item.subject.colorToken)
        : planColorToken(label),
      sortOrder: index,
    };
  });

  const studyPlanId = await prisma.$transaction(async (tx) => {
    const shared = {
      title: plan.title,
      description: plan.overview,
      startDate: cairoDayStart(period.startDate),
      endDate: cairoDayStart(period.endDate),
      academicYear: plan.user.academicYear,
    };
    // Re-read rather than trusting `studyPlanId`: the forum copy may have been deleted between the
    // two queries, in which case `SetNull` has already un-published and this is a first publish.
    const existing = plan.studyPlanId
      ? await tx.studyPlan.findFirst({
          where: { id: plan.studyPlanId, authorId: userId },
          select: { id: true },
        })
      : null;
    const forumPlan = existing
      ? await tx.studyPlan.update({
          where: { id: existing.id },
          data: shared,
          select: { id: true },
        })
      : await tx.studyPlan.create({
          // Publishing puts the plan on your own shelf. Sharing it with your year stays a separate,
          // deliberate press on the forum board.
          data: { ...shared, authorId: userId, visibility: "PRIVATE" },
          select: { id: true },
        });

    await tx.studyPlanItem.deleteMany({ where: { planId: forumPlan.id } });
    await tx.studyPlanItem.createMany({
      data: notes.map((note) => ({ ...note, planId: forumPlan.id })),
    });
    if (plan.studyPlanId !== forumPlan.id)
      await tx.examPlan.update({
        where: { id: plan.id },
        data: { studyPlanId: forumPlan.id },
      });
    return forumPlan.id;
  });

  return { studyPlanId, itemCount: notes.length, period, republished: Boolean(plan.studyPlanId) };
}
