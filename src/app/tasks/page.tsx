import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { PageShell } from "@/components/ui/page-shell";

export default async function TasksPage() {
  const user = await requireUser();
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, name: true, colorToken: true },
    orderBy: { name: "asc" },
  });
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <TaskWorkspace locale={locale} initialSubjects={subjects} />
    </PageShell>
  );
}
