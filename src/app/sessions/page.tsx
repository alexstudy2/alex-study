import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/sessions/queries";
import { SessionList } from "@/components/sessions/session-list";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await prisma.studySession.findMany({
    where: { userId: user.id },
    include: sessionInclude,
    orderBy: { startedAt: "desc" },
    take: 100,
  });
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main className="sessions-shell" dir={locale === "ar" ? "rtl" : "ltr"}>
      <header className="sessions-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{locale === "ar" ? "سجل الدراسة" : "Study record"}</p>
          <h1>{locale === "ar" ? "كل دقيقة لها قصة." : "Every minute has a story."}</h1>
        </div>
        <Link className="primary-button" href="/focus">
          {locale === "ar" ? "ابدأ جلسة" : "Start a session"}
        </Link>
      </header>
      <SessionList sessions={sessions} locale={locale} />
    </main>
  );
}
