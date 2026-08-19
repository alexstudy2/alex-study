import Link from "next/link";
import { StickyNote } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { forumShelves } from "@/lib/plan-forum/queries";
import { PlanForumWorkspace } from "@/components/plan-forum/plan-forum-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";

export default async function PlanForumPage() {
  const user = await requireUser();
  const shelves = await forumShelves(user);
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={StickyNote}
        isRtl={ar}
        eyebrow={ar ? "منتدى الخطط" : "Plan forum"}
        title={ar ? "خطّة على ورق لاصق." : "A plan, one note per day."}
        description={
          ar
            ? "اكتب خطّة لامتحان أو أسبوع، ثم شاركها مع سنتك أو طبّقها على تقويمك."
            : "Build a plan for an exam or a week, then share it with your year or apply it to your calendar."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/calendar">
              {ar ? "التقويم" : "Calendar"}
            </Link>
            <Link className="page-header-link" href="/tasks">
              {ar ? "المهام" : "Tasks"}
            </Link>
          </div>
        }
      />
      <PlanForumWorkspace
        locale={locale}
        academicYear={user.academicYear}
        initialMine={shelves.mine}
        initialSaved={shelves.saved}
        initialClassFeed={shelves.classFeed}
      />
    </PageShell>
  );
}
