import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/sessions/queries";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SessionManager } from "@/components/sessions/session-manager";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await requireUser();
  const { sessionId } = await params;
  const [session, subjects, tasks] = await Promise.all([
    prisma.studySession.findFirst({ where: { id: sessionId, userId: user.id }, include: sessionInclude }),
    prisma.subject.findMany({ where: { userId: user.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.task.findMany({ where: { userId: user.id, deletedAt: null, parentTaskId: null }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  if (!session) notFound();
  const ar = user.locale === "AR";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        backHref="/sessions"
        backLabel={ar ? "كل الجلسات" : "All sessions"}
        isRtl={ar}
        eyebrow={ar ? "تفاصيل الجلسة" : "Session detail"}
        title={
          session.task?.title ??
          session.subject?.name ??
          (ar ? "جلسة مستقلة" : "Independent session")
        }
        actions={
          <div className="score-orbit">
            <strong>{session.focusScore ?? "—"}</strong>
            <span>{ar ? "درجة التركيز" : "Focus Score"}</span>
          </div>
        }
      />
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
      <SessionManager
        locale={ar ? "ar" : "en"}
        subjects={subjects}
        tasks={tasks}
        initial={{
          id: session.id,
          taskId: session.taskId,
          subjectId: session.subjectId,
          startedAt: session.startedAt.toISOString(),
          endedAt: (session.endedAt ?? session.startedAt).toISOString(),
          plannedDurationSeconds: session.plannedDurationSeconds,
          distractionCount: session.distractionCount,
          reflection: session.reflection,
        }}
      />
      {session.reflection && (
        <section className="reflection-card mt-6">
          <h2>{ar ? "تأمل الجلسة" : "Session reflection"}</h2>
          <p>{session.reflection}</p>
        </section>
      )}
      <section className="distraction-log mt-6">
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
    </PageShell>
  );
}
