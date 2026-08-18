import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { timerRunInclude } from "@/lib/sessions/queries";
import { FocusWorkspace } from "@/components/sessions/focus-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Timer } from "lucide-react";

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
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Timer}
        eyebrow={ar ? "مساحة تركيز" : "Focus studio"}
        title={ar ? "امنح عقلك مساحة واحدة." : "Give your mind one room."}
        description={
          ar
            ? "جلسات تركيز عميقة مبنية على تقنية بومودورو مع تقليل التشتت."
            : "Deep work sessions built on Pomodoro technique with distraction logging."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/tasks">
              {ar ? "المهام" : "Tasks"}
            </Link>
            <Link className="page-header-link" aria-current="page" href="/focus">
              {ar ? "التركيز" : "Focus"}
            </Link>
            <Link className="page-header-link" href="/sessions">
              {ar ? "الجلسات" : "Sessions"}
            </Link>
          </div>
        }
      />
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
    </PageShell>
  );
}
