import { ExamPlanCreateForm } from "@/components/exam-plans/exam-plan-create-form";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function NewExamPlanPage() {
  const user = await requireUser();
  const [profile, recentPlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      /* weekStartsOn orders the rest-day toggles. Someone who set a Saturday-first week should not
         have to hunt for their day off in a Sunday-first row. */
      select: { aiNudgesEnabled: true, weekStartsOn: true },
    }),
    prisma.examPlan.findMany({
      where: { userId: user.id },
      select: { id: true, title: true, examAt: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);
  return (
    <ExamPlanCreateForm
      locale={user.locale === "AR" ? "ar" : "en"}
      recentPlans={recentPlans}
      aiEnabled={profile?.aiNudgesEnabled ?? true}
      weekStartsOn={profile?.weekStartsOn ?? 0}
    />
  );
}
