import { canonicalPair } from "@/lib/social/pairs";
import { prisma } from "@/lib/db/prisma";

/** Everything the friends UI draws for a person: name, initial avatar, year pill. */
export const socialPersonSelect = { id: true, name: true, academicYear: true } as const;

/* Three mutation routes used to return the bare row from `update()` while the client dropped it
   straight into the state that renders the cards -- `person(f).name` and `other.name` on rows whose
   relations were never loaded, which is a TypeError, not a blank name. Accepting a friend request,
   inviting an accountability partner and accepting that invite each white-screened the page on
   success. Both shapes live here so a response and the page's own query cannot drift again. */
export const friendshipInclude = {
  requester: { select: socialPersonSelect },
  addressee: { select: socialPersonSelect },
} as const;

export const accountabilityPairInclude = {
  userA: { select: socialPersonSelect },
  userB: { select: socialPersonSelect },
} as const;

export type RelationshipMark = "none" | "friends" | "incoming" | "outgoing" | "blocked";

/** What the viewer's relationship to each search hit is, so the row can say "Already friends"
    instead of offering an Add button that comes back as a generic failure. */
export async function relationshipMarks(userId: string, otherIds: string[]) {
  const marks = new Map<string, RelationshipMark>();
  if (!otherIds.length) return marks;
  const byKey = new Map(otherIds.map((id) => [canonicalPair(userId, id).pairKey, id]));
  const friendships = await prisma.friendship.findMany({
    where: { pairKey: { in: [...byKey.keys()] } },
    select: { pairKey: true, status: true, requesterId: true },
  });
  for (const friendship of friendships) {
    const otherId = byKey.get(friendship.pairKey);
    if (!otherId) continue;
    marks.set(
      otherId,
      friendship.status === "ACCEPTED"
        ? "friends"
        : friendship.status === "BLOCKED"
          ? "blocked"
          : friendship.status === "PENDING"
            ? friendship.requesterId === userId
              ? "outgoing"
              : "incoming"
            : "none",
    );
  }
  return marks;
}
