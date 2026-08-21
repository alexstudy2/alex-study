import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { canonicalPair } from "@/lib/social/pairs";
import { friendshipInclude } from "@/lib/social/queries";
import { friendRequestSchema } from "@/lib/social/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const requests = await prisma.friendship.findMany({
    where: { status: "PENDING", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: friendshipInclude,
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ requests });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = friendRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.userId === user.id) return invalid();
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) return invalid();
  const { pairKey } = canonicalPair(user.id, target.id);
  const existing = await prisma.friendship.findUnique({ where: { pairKey } });
  if (
    existing?.status === "BLOCKED" ||
    existing?.status === "ACCEPTED" ||
    existing?.status === "PENDING"
  )
    return invalid({ relationship: ["unavailable"] });
  let friendship;
  try {
    friendship = existing
      ? await prisma.friendship.update({
          where: { id: existing.id },
          data: {
            requesterId: user.id,
            addresseeId: target.id,
            status: "PENDING",
            blockedById: null,
            respondedAt: null,
          },
          include: friendshipInclude,
        })
      : await prisma.friendship.create({
          data: { requesterId: user.id, addresseeId: target.id, pairKey },
          include: friendshipInclude,
        });
  } catch (error) {
    /* `pairKey` is unique, so a double-tapped Add button raced this create and the loser used to
       surface as a 500. It is the same outcome as the check above -- a request already exists. */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return invalid({ relationship: ["unavailable"] });
    throw error;
  }
  await createNotification({
    userId: target.id,
    type: "FRIEND_REQUEST",
    title: `${user.name} sent you a friend request`,
    body: "Review the request when you are ready.",
    actionUrl: "/friends",
  });
  return Response.json({ friendship }, { status: 201 });
}
