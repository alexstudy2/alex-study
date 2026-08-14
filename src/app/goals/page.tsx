import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { goalsWithProgress } from "@/lib/goals/queries";
import { GoalWorkspace } from "@/components/goals/goal-workspace";
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
  return (
    <main className="goals-shell">
      <header className="goals-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{locale === "ar" ? "أهداف الدراسة" : "Study goals"}</p>
          <h1>{locale === "ar" ? "اجعل التقدم مرئيًا." : "Make progress visible."}</h1>
        </div>
        <nav>
          <Link href="/dashboard">{locale === "ar" ? "الرئيسية" : "Dashboard"}</Link>
          <Link href="/calendar">{locale === "ar" ? "التقويم" : "Calendar"}</Link>
        </nav>
      </header>
      <GoalWorkspace
        initialGoals={goals as unknown as Goal[]}
        subjects={subjects}
        locale={locale}
      />
    </main>
  );
}
