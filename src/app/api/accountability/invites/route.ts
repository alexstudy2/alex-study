import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { canonicalPair } from "@/lib/social/pairs";
import { accountabilityInviteSchema } from "@/lib/social/validation";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = accountabilityInviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const friendship = await prisma.friendship.findFirst({
    where: {
      id: parsed.data.friendshipId,
      status: "ACCEPTED",
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
  });
  if (!friendship) return notFound();
  const otherId =
    friendship.requesterId === user.id ? friendship.addresseeId : friendship.requesterId;
  const { userAId, userBId, pairKey } = canonicalPair(user.id, otherId);
  const existing = await prisma.accountabilityPair.findUnique({ where: { pairKey } });
  if (existing && existing.status !== "ENDED" && existing.status !== "DECLINED")
    return invalid({ relationship: ["unavailable"] });
  const pair = existing
    ? await prisma.accountabilityPair.update({
        where: { id: existing.id },
        data: { createdById: user.id, status: "PENDING", respondedAt: null, endedAt: null },
      })
    : await prisma.accountabilityPair.create({
        data: { userAId, userBId, createdById: user.id, pairKey },
      });
  await createNotification({
    userId: otherId,
    type: "ACCOUNTABILITY_INVITE",
    title: `${user.name} invited you to be accountability partners`,
    body: "Pairing is opt-in and can be paused or ended at any time.",
    actionUrl: "/friends",
    email: true,
  });
  return Response.json({ pair }, { status: 201 });
}
