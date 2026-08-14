import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        eyebrow={ar ? "مخطط الدراسة" : "Study planner"}
        title={ar ? "ما الخطوة التالية؟" : "What comes next?"}
        description={
          ar
            ? "رتّب المذاكرة إلى خطوات واضحة، وراجع يومك دون ضغط."
            : "Shape study into clear steps and see your day without the noise."
        }
      />
      <TaskWorkspace locale={locale} initialSubjects={subjects} />
    </PageShell>
  );
}
