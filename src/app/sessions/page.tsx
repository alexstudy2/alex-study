import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/sessions/queries";
import { SessionList } from "@/components/sessions/session-list";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: sessionInclude,
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "سجل الدراسة" : "Study record"}
        title={ar ? "كل دقيقة لها قصة." : "Every minute has a story."}
        description={
          ar
            ? "سجل كامل ومفصل لجميع جلسات التركيز المكتملة ودرجات الجودة."
            : "Complete archive of completed focus sessions, distraction logs, and reflections."
        }
        actions={
          <Button
            href="/focus"
            variant="primary"
            size="sm"
            leftIcon={<Play className="w-4 h-4" />}
          >
            {ar ? "ابدأ جلسة" : "Start a session"}
          </Button>
        }
      />
      <SessionList sessions={sessions} locale={locale} />
    </PageShell>
  );
}
