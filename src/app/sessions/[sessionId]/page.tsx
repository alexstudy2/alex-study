import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/sessions/queries";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    include: sessionInclude,
  });
  if (!session) notFound();
  const ar = user.locale === "AR";
  return (
    <main className="session-detail-shell" dir={ar ? "rtl" : "ltr"}>
      <Link className="back-link" href="/sessions">
        ← {ar ? "كل الجلسات" : "All sessions"}
      </Link>
      <header className="session-detail-header">
        <div>
          <p className="eyebrow">{ar ? "تفاصيل الجلسة" : "Session detail"}</p>
          <h1>
            {session.task?.title ??
              session.subject?.name ??
              (ar ? "جلسة مستقلة" : "Independent session")}
          </h1>
        </div>
        <div className="score-orbit">
          <strong>{session.focusScore ?? "—"}</strong>
          <span>{ar ? "درجة التركيز" : "Focus Score"}</span>
        </div>
      </header>
      <dl className="detail-metrics">
        <div>
          <dt>{ar ? "المدة الفعلية" : "Actual time"}</dt>
          <dd>
            {Math.round(session.durationSeconds / 60)} {ar ? "دقيقة" : "minutes"}
          </dd>
        </div>
        <div>
          <dt>{ar ? "المدة المخططة" : "Planned time"}</dt>
          <dd>
            {Math.round(session.plannedDurationSeconds / 60)} {ar ? "دقيقة" : "minutes"}
          </dd>
        </div>
        <div>
          <dt>{ar ? "التشتت" : "Distractions"}</dt>
          <dd>{session.distractionCount}</dd>
        </div>
        <div>
          <dt>{ar ? "المصدر" : "Source"}</dt>
          <dd>{session.source}</dd>
        </div>
      </dl>
      {session.reflection && (
        <section className="reflection-card">
          <h2>{ar ? "تأمل الجلسة" : "Session reflection"}</h2>
          <p>{session.reflection}</p>
        </section>
      )}
      <section className="distraction-log">
        <h2>{ar ? "سجل التشتت" : "Distraction log"}</h2>
        {session.distractions.length ? (
          <ol>
            {session.distractions.map((item) => (
              <li key={item.id}>
                <time>
                  {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                    timeStyle: "medium",
                    timeZone: "Africa/Cairo",
                  }).format(item.occurredAt)}
                </time>
                {item.note && <span>{item.note}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted-copy">
            {ar ? "لم يتم تسجيل أي تشتت." : "No distractions were recorded."}
          </p>
        )}
      </section>
    </main>
  );
}
