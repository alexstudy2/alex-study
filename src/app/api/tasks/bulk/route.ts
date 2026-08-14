import { prisma } from "@/lib/db/prisma";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";
import { bulkSchema } from "@/lib/tasks/validation";
import { recalculateChallengesForUser } from "@/lib/challenges/engine";
export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = bulkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const { taskIds, action, priority } = parsed.data;
  const where = {
    id: { in: taskIds },
    userId: user.id,
    deletedAt: null,
    ...(action === "COMPLETE" ? { status: { not: "COMPLETED" as const } } : {}),
  };
  const data =
    action === "COMPLETE"
      ? { status: "COMPLETED" as const, completedAt: new Date() }
      : action === "REOPEN"
        ? { status: "TODO" as const, completedAt: null }
        : action === "DELETE"
          ? { deletedAt: new Date() }
          : { priority };
  const result = await prisma.task.updateMany({ where, data });
  if (result.count) await recalculateChallengesForUser(user.id);
  return Response.json({ updated: result.count });
}
