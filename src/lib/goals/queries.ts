import { prisma } from "@/lib/db/prisma";
import { calculateGoalProgress } from "./progress";

export const goalInclude = { subject: { select: { id: true, name: true, colorToken: true } } };

export async function goalsWithProgress(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: goalInclude,
    orderBy: [{ status: "asc" }, { deadline: "asc" }],
  });
  return Promise.all(
    goals.map(async (goal) => {
      const subjectFilter = goal.subjectId ? { subjectId: goal.subjectId } : {};
      if (goal.metric === "STUDY_MINUTES") {
        const aggregate = await prisma.studySession.aggregate({
          where: {
            userId,
            status: "COMPLETED",
            startedAt: { gte: goal.startsAt, lte: goal.deadline },
            ...subjectFilter,
          },
          _sum: { durationSeconds: true },
        });
        return {
          ...goal,
          progress: calculateGoalProgress({
            ...goal,
            studySeconds: aggregate._sum.durationSeconds,
          }),
        };
      }
      const tasksCompleted = await prisma.task.count({
        where: {
          userId,
          deletedAt: null,
          status: "COMPLETED",
          completedAt: { gte: goal.startsAt, lte: goal.deadline },
          ...subjectFilter,
        },
      });
      return { ...goal, progress: calculateGoalProgress({ ...goal, tasksCompleted }) };
    }),
  );
}
