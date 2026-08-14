import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { TaskDetail } from "@/components/tasks/task-detail";
import { taskInclude } from "@/lib/tasks/queries";
export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser();
  const { taskId } = await params;
  const [task, subjects] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, userId: user.id, deletedAt: null },
      include: taskInclude,
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!task) notFound();
  return <TaskDetail task={task} subjects={subjects} locale={user.locale === "AR" ? "ar" : "en"} />;
}
