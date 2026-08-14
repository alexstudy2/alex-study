import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { goalsWithProgress } from "@/lib/goals/queries";
import { GoalWorkspace } from "@/components/goals/goal-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import type { Goal } from "@/components/goals/types";

export default async function GoalsPage() {
  const user = await requireUser();
  const [goals, subjects] = await Promise.all([
    goalsWithProgress(user.id),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "أهداف الدراسة" : "Study goals"}
        title={ar ? "اجعل التقدم مرئيًا." : "Make progress visible."}
        description={
          ar
            ? "حدد أهدافًا أسبوعية وشهرية للمذاكرة وإنجاز المهام."
            : "Set measurable study minute and task completion goals with visual progress."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/dashboard">
              {ar ? "الرئيسية" : "Dashboard"}
            </Link>
            <Link className="page-header-link" href="/calendar">
              {ar ? "التقويم" : "Calendar"}
            </Link>
          </div>
        }
      />
      <GoalWorkspace
        initialGoals={goals as unknown as Goal[]}
        subjects={subjects}
        locale={locale}
      />
    </PageShell>
  );
}
