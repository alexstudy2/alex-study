import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { reorderSchema } from "@/lib/tasks/validation";
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const owned = await prisma.task.count({
    where: {
      id: { in: parsed.data.taskIds },
      userId: user.id,
      parentTaskId: null,
      deletedAt: null,
    },
  });
  if (owned !== parsed.data.taskIds.length) return invalid();
  await prisma.$transaction(
    parsed.data.taskIds.map((id, sortOrder) =>
      prisma.task.update({ where: { id }, data: { sortOrder } }),
    ),
  );
  return Response.json({ ok: true });
}
