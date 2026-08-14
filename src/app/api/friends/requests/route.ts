import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { canonicalPair } from "@/lib/social/pairs";
import { friendRequestSchema } from "@/lib/social/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const requests = await prisma.friendship.findMany({
    where: { status: "PENDING", OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: {
      requester: { select: { id: true, name: true, academicYear: true } },
      addressee: { select: { id: true, name: true, academicYear: true } },
    },
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
  const friendship = existing
    ? await prisma.friendship.update({
        where: { id: existing.id },
        data: {
          requesterId: user.id,
          addresseeId: target.id,
          status: "PENDING",
          blockedById: null,
          respondedAt: null,
        },
      })
    : await prisma.friendship.create({
        data: { requesterId: user.id, addresseeId: target.id, pairKey },
      });
  await createNotification({
    userId: target.id,
    type: "FRIEND_REQUEST",
    title: `${user.name} sent you a friend request`,
    body: "Review the request when you are ready.",
    actionUrl: "/friends",
  });
  return Response.json({ friendship }, { status: 201 });
}
