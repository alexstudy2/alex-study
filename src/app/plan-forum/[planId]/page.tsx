import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { visiblePlan } from "@/lib/plan-forum/queries";
import { PlanBoard } from "@/components/plan-forum/plan-board";
import { PageShell } from "@/components/ui/page-shell";

export default async function PlanBoardPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireUser();
  const { planId } = await params;
  const plan = await visiblePlan(user, planId);
  // A plan the viewer may not read is indistinguishable from one that does not exist.
  if (!plan) notFound();

  /* The author's own course names, for the note form's datalist. Only fetched for the author: a
     reader has no form to fill, and their course list is none of this page's business. */
  const subjects = plan.isMine
    ? (
        await prisma.subject.findMany({
          where: { userId: user.id, archivedAt: null },
          select: { name: true },
          orderBy: { name: "asc" },
        })
      ).map((subject) => subject.name)
    : [];
  const locale = user.locale === "AR" ? "ar" : "en";

  return (
    <PageShell dir={locale === "ar" ? "rtl" : "ltr"} size="wide">
      <PlanBoard plan={plan} subjects={subjects} locale={locale} />
    </PageShell>
  );
}
