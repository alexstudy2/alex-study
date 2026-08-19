import { prisma } from "@/lib/db/prisma";
import { cairoDateKey } from "@/lib/calendar/dates";
import { normalizeLabel, planColorToken, safeColorToken } from "./colors";
import { cairoDayAt9, planDayCount } from "./dates";
import { canViewPlan } from "./permissions";
import type { PlanDetail, PlanItem, PlanOption, PlanSummary, PlanViewer } from "./types";

/**
 * Plan Forum reads. Every read that can return somebody else's plan goes through `canViewPlan`
 * (./permissions), so no route has to decide for itself who may see what.
 */

/** How many class plans the feed shows. A forum, not an archive -- newest shares are what matter. */
const CLASS_FEED_LIMIT = 30;

/** Guards the items POST. Generous enough to be invisible; low enough to bound the board payload. */
export const MAX_ITEMS_PER_PLAN = 400;

function toItem(item: {
  id: string;
  dayDate: Date;
  title: string;
  subjectLabel: string;
  colorToken: string;
}): PlanItem {
  return {
    id: item.id,
    dayDate: cairoDateKey(item.dayDate),
    title: item.title,
    subjectLabel: item.subjectLabel,
    colorToken: safeColorToken(item.colorToken),
  };
}

type PlanRow = {
  id: string;
  authorId: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  visibility: "PRIVATE" | "CLASS";
  sharedAt: Date | null;
  author: { id: string; name: string };
  _count: { items: number; saves: number };
};

const planSummaryArgs = {
  select: {
    id: true,
    authorId: true,
    title: true,
    description: true,
    startDate: true,
    endDate: true,
    visibility: true,
    sharedAt: true,
    author: { select: { id: true, name: true } },
    _count: { select: { items: true, saves: true } },
  },
} as const;

function toSummary(plan: PlanRow, viewerId: string, savedByMe: boolean): PlanSummary {
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    startDate: cairoDateKey(plan.startDate),
    endDate: cairoDateKey(plan.endDate),
    dayCount: planDayCount(plan.startDate, plan.endDate),
    itemCount: plan._count.items,
    saveCount: plan._count.saves,
    visibility: plan.visibility,
    sharedAt: plan.sharedAt ? plan.sharedAt.toISOString() : null,
    author: plan.author,
    isMine: plan.authorId === viewerId,
    savedByMe,
  };
}

/**
 * One plan with its notes, or null when the viewer may not see it.
 *
 * Returns null rather than throwing so callers can decide between `notFound()` and a 404 page --
 * and so a private plan is indistinguishable from a missing one, which is the point.
 */
export async function visiblePlan(viewer: PlanViewer, planId: string): Promise<PlanDetail | null> {
  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    select: {
      ...planSummaryArgs.select,
      academicYear: true,
      items: {
        select: { id: true, dayDate: true, title: true, subjectLabel: true, colorToken: true },
        orderBy: [{ dayDate: "asc" }, { sortOrder: "asc" }],
      },
      saves: { where: { userId: viewer.id }, select: { id: true }, take: 1 },
    },
  });
  if (!plan) return null;
  const savedByMe = plan.saves.length > 0;
  if (!canViewPlan(viewer, plan, savedByMe)) return null;
  return { ...toSummary(plan, viewer.id, savedByMe), items: plan.items.map(toItem) };
}

/**
 * The plan a route is about to mutate, checked for authorship only.
 *
 * Separate from `visiblePlan` because the period and the raw dates are what a mutation needs, and
 * because "may read" is a strictly weaker test than "may edit" -- keeping them apart means an
 * items POST can never accidentally accept a reader's request.
 */
export async function authoredPlan(userId: string, planId: string) {
  const plan = await prisma.studyPlan.findUnique({
    where: { id: planId },
    select: { id: true, authorId: true, startDate: true, endDate: true, visibility: true },
  });
  return plan && plan.authorId === userId ? plan : null;
}

/**
 * A typed subject label -> that user's own course, when they have one by that name.
 *
 * Runs server-side for both the typed and the picked case, because the client sends only text: one
 * code path, and no request can claim a `subjectId` belonging to somebody else. When nothing
 * matches, the label still gets a stable colour from `planColorToken` -- what it does *not* get is
 * a new `Subject` row. Writing one would mean every note typed on a plan silently enrols a course
 * on /tasks, which is not what the student asked for.
 *
 * `userId` is whoever the resolution is *for*: the author when adding a note, the caller when
 * copying a day into their own tasks.
 */
export async function resolveSubject(userId: string, subjectLabel: string) {
  const subject = await prisma.subject.findFirst({
    where: { userId, normalizedName: normalizeLabel(subjectLabel), archivedAt: null },
    select: { id: true, colorToken: true },
  });
  return {
    subjectId: subject?.id ?? null,
    colorToken: subject ? safeColorToken(subject.colorToken) : planColorToken(subjectLabel),
  };
}

/** The three shelves of the forum: what I wrote, what I bookmarked, what my year is sharing. */
export async function forumShelves(viewer: PlanViewer) {
  const [mine, saves, classFeed] = await Promise.all([
    prisma.studyPlan.findMany({
      where: { authorId: viewer.id },
      ...planSummaryArgs,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studyPlanSave.findMany({
      where: { userId: viewer.id, plan: { authorId: { not: viewer.id } } },
      select: { plan: planSummaryArgs },
      orderBy: { createdAt: "desc" },
    }),
    prisma.studyPlan.findMany({
      where: {
        visibility: "CLASS",
        academicYear: viewer.academicYear,
        authorId: { not: viewer.id },
      },
      ...planSummaryArgs,
      orderBy: { sharedAt: "desc" },
      take: CLASS_FEED_LIMIT,
    }),
  ]);
  const savedIds = new Set(saves.map((save) => save.plan.id));
  return {
    mine: mine.map((plan) => toSummary(plan, viewer.id, savedIds.has(plan.id))),
    saved: saves.map((save) => toSummary(save.plan, viewer.id, true)),
    classFeed: classFeed.map((plan) => toSummary(plan, viewer.id, savedIds.has(plan.id))),
  };
}

/**
 * Plans the viewer may point their calendar at: their own, plus their bookmarks.
 *
 * Not the whole class feed. Switching the calendar to a plan is a deliberate act on a plan you
 * chose to keep, and a select listing every share in the year would be a browser, not a switch.
 */
export async function planOptions(viewer: PlanViewer): Promise<PlanOption[]> {
  const [mine, saves] = await Promise.all([
    prisma.studyPlan.findMany({
      where: { authorId: viewer.id },
      select: { id: true, title: true, startDate: true, endDate: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.studyPlanSave.findMany({
      where: { userId: viewer.id, plan: { authorId: { not: viewer.id } } },
      select: {
        plan: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            author: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return [
    ...mine.map((plan) => ({
      id: plan.id,
      title: plan.title,
      startDate: cairoDateKey(plan.startDate),
      endDate: cairoDateKey(plan.endDate),
      authorName: "",
      isMine: true,
    })),
    ...saves.map(({ plan }) => ({
      id: plan.id,
      title: plan.title,
      startDate: cairoDateKey(plan.startDate),
      endDate: cairoDateKey(plan.endDate),
      authorName: plan.author.name,
      isMine: false,
    })),
  ];
}

/**
 * A plan's notes as calendar events, so the month grid can paint them with the rules it already
 * has. `startsAt` is 09:00 Cairo (see cairoDayAt9) and `status` is the sentinel "PLAN", which is
 * what the day cell keys its styling off.
 *
 * The window bounds are the same ones `calendarEvents` uses, and a note's `dayDate` is Cairo
 * midnight -- so any day inside the grid falls between them without further arithmetic.
 */
export async function planCalendarEvents(planId: string, start: Date, end: Date) {
  const items = await prisma.studyPlanItem.findMany({
    where: { planId, dayDate: { gte: start, lte: end } },
    select: { id: true, dayDate: true, title: true, subjectLabel: true, colorToken: true },
    orderBy: [{ dayDate: "asc" }, { sortOrder: "asc" }],
  });
  return items.map((item) => {
    const dayKey = cairoDateKey(item.dayDate);
    return {
      type: "plan" as const,
      id: item.id,
      startsAt: cairoDayAt9(dayKey),
      title: item.title,
      subject: { id: item.id, name: item.subjectLabel, colorToken: safeColorToken(item.colorToken) },
      status: "PLAN",
      minutes: null,
      priority: null,
    };
  });
}
