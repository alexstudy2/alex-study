import type { PlanViewer } from "./types";

/**
 * Plan Forum authorisation.
 *
 * Its own module, with no Prisma import, for the same reason src/lib/lobbies/permissions.ts is:
 * this is the one piece of the feature where a mistake leaks somebody's work, and as a pure
 * predicate over three plain values every branch is testable without a database.
 */

/**
 * Can this viewer read this plan?
 *
 * Note the second clause. A viewer who bookmarked a plan keeps access even after the author
 * unshares it -- their shelf would otherwise fill with rows they cannot open, and they had the
 * contents already. Unsharing stops *new* readers; it does not retract.
 */
export function canViewPlan(
  viewer: PlanViewer,
  plan: { authorId: string; visibility: "PRIVATE" | "CLASS"; academicYear: number },
  savedByViewer: boolean,
) {
  if (plan.authorId === viewer.id) return true;
  if (savedByViewer) return true;
  return plan.visibility === "CLASS" && plan.academicYear === viewer.academicYear;
}
