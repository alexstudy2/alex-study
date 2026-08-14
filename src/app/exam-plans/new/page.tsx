import { ExamPlanCreateForm } from "@/components/exam-plans/exam-plan-create-form";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function NewExamPlanPage() {
  const user = await requireUser();
  const [profile, recentPlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { aiNudgesEnabled: true },
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
    />
  );
}
