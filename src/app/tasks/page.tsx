import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { TaskWorkspace } from "@/components/tasks/task-workspace";
export default async function TasksPage() {
  const user = await requireUser();
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, name: true, colorToken: true },
    orderBy: { name: "asc" },
  });
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main id="main-content" className="page-shell">
      <header className="tasks-header">
        <div>
          <p className="eyebrow">{locale === "ar" ? "مخطط الدراسة" : "Study planner"}</p>
          <h1>{locale === "ar" ? "ما الخطوة التالية؟" : "What comes next?"}</h1>
          <p>
            {locale === "ar"
              ? "رتّب المذاكرة إلى خطوات واضحة، وراجع يومك دون ضغط."
              : "Shape study into clear steps and see your day without the noise."}
          </p>
        </div>
      </header>
      <TaskWorkspace locale={locale} initialSubjects={subjects} />
    </main>
  );
}
