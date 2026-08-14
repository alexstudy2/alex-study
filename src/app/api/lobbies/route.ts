import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { roomInputSchema } from "@/lib/lobbies/validation";
export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const rooms = await prisma.room.findMany({
    where: {
      archivedAt: null,
      OR: [{ visibility: "PUBLIC" }, { members: { some: { userId: user.id } } }],
    },
    include: {
      _count: { select: { members: true } },
      members: { where: { userId: user.id }, select: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ rooms });
}
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const p = roomInputSchema.safeParse(await request.json().catch(() => null));
  if (!p.success) return invalid(p.error.flatten().fieldErrors);
  const room = await prisma.room.create({
    data: {
      ownerId: user.id,
      ...p.data,
      description: p.data.description || null,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
    include: { members: true },
  });
  return Response.json({ room }, { status: 201 });
}
