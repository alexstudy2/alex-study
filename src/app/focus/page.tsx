import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { timerRunInclude } from "@/lib/sessions/queries";
import { FocusWorkspace } from "@/components/sessions/focus-workspace";

export default async function FocusPage() {
  const user = await requireUser();
  const [preference, tasks, subjects, timer] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId: user.id } }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        parentTaskId: null,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      select: { id: true, title: true, subjectId: true },
      orderBy: [{ dueAt: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
      orderBy: { name: "asc" },
    }),
    prisma.timerRun.findFirst({
      where: { userId: user.id, status: { in: ["RUNNING", "PAUSED"] } },
      include: timerRunInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main id="main-content" className="focus-shell">
      <header className="focus-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{locale === "ar" ? "مساحة تركيز" : "Focus studio"}</p>
          <h1>{locale === "ar" ? "امنح عقلك مساحة واحدة." : "Give your mind one room."}</h1>
        </div>
        <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
          <Link href="/tasks">{locale === "ar" ? "المهام" : "Tasks"}</Link>
          <Link aria-current="page" href="/focus">
            {locale === "ar" ? "التركيز" : "Focus"}
          </Link>
          <Link href="/sessions">{locale === "ar" ? "الجلسات" : "Sessions"}</Link>
        </nav>
      </header>
      <FocusWorkspace
        locale={locale}
        preferences={{
          focus: preference?.defaultFocusMinutes ?? 25,
          shortBreak: preference?.defaultShortBreakMinutes ?? 5,
          longBreak: preference?.defaultLongBreakMinutes ?? 15,
          ambientSound: preference?.ambientSound ?? null,
          ambientVolume: preference?.ambientVolume ?? 35,
        }}
        tasks={tasks}
        subjects={subjects}
        initialTimer={timer}
        initialServerNow={new Date().toISOString()}
      />
    </main>
  );
}
