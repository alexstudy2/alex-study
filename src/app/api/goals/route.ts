import { prisma } from "@/lib/db/prisma";
import { goalsWithProgress, goalInclude } from "@/lib/goals/queries";
import { goalInputSchema } from "@/lib/goals/validation";
import { apiUser, invalid, unauthorized } from "@/lib/tasks/response";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  return Response.json({ goals: await goalsWithProgress(user.id) });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const parsed = goalInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  if (
    data.subjectId &&
    !(await prisma.subject.findFirst({
      where: { id: data.subjectId, userId: user.id, archivedAt: null },
    }))
  )
    return invalid({ subjectId: ["Unknown subject"] });
  const goal = await prisma.goal.create({
    data: {
      userId: user.id,
      ...data,
      subjectId: data.subjectId || null,
      startsAt: new Date(data.startsAt),
      deadline: new Date(data.deadline),
    },
    include: goalInclude,
  });
  return Response.json({ goal }, { status: 201 });
}
