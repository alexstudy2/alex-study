import { prisma } from "@/lib/db/prisma";
import { createNotification } from "@/lib/notifications/service";
import { canAcceptFriendship } from "@/lib/social/pairs";
import { friendshipInclude } from "@/lib/social/queries";
import { apiUser, invalid, notFound, unauthorized } from "@/lib/tasks/response";

export async function POST(
  _request: Request,
  context: { params: Promise<{ friendshipId: string; action: string }> },
) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { friendshipId, action } = await context.params;
  if (action !== "accept" && action !== "decline") return invalid();
  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship || !canAcceptFriendship(friendship, user.id)) return notFound();
  const updated = await prisma.friendship.update({
    where: { id: friendship.id },
    data: { status: action === "accept" ? "ACCEPTED" : "DECLINED", respondedAt: new Date() },
    // The accepted row is what the client moves into its friends list and renders immediately.
    include: friendshipInclude,
  });
  if (action === "accept")
    await createNotification({
      userId: friendship.requesterId,
      type: "FRIEND_ACCEPTED",
      title: `${user.name} accepted your friend request`,
      body: "You can now invite each other as accountability partners.",
      actionUrl: "/friends",
    });
  return Response.json({ friendship: updated });
}
