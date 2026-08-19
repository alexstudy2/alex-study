import { notFound } from "next/navigation";
import { ExamPlanEditor } from "@/components/exam-plans/exam-plan-editor";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getExamPlan } from "@/lib/exam-plans/service";

export default async function ExamPlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const user = await requireUser();
  const { planId } = await params;
  const [plan, subjects] = await Promise.all([
    getExamPlan(user.id, planId),
    prisma.subject.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, colorToken: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!plan) notFound();
  return (
    <ExamPlanEditor
      locale={user.locale === "AR" ? "ar" : "en"}
      initialPlan={plan}
      subjects={subjects}
    />
  );
}
