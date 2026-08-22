import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getAdmin } from "@/lib/admin/guard";
import { getUserDetail } from "@/lib/admin/queries";
import { AdminUserActions } from "@/components/admin/user-actions";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [detail, session, admin] = await Promise.all([
    getUserDetail(userId),
    getSession(),
    getAdmin(),
  ]);
  if (!detail) notFound();
  const selfId = session?.user?.id ?? admin?.id ?? "";
  const { user, recentTasks, recentSessions, activeTimers, aiJobs, manualResets, targetAudit } =
    detail;

  return (
    <div className="admin-stack">
      <Link href="/admin/users" className="text-sm underline">
        ← All users
      </Link>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="ui-card p-4">
          <h1 className="admin-page-title">{user.name}</h1>
          <p className="font-mono text-xs text-muted">{user.collegeId} · Year {user.academicYear}</p>
          <dl className="admin-meta-list grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
            <div><dt className="inline font-bold">Role: </dt><dd className="inline">{user.role}</dd></div>
            <div><dt className="inline font-bold">Email: </dt><dd className="inline">{user.email ?? "—"}</dd></div>
            <div><dt className="inline font-bold">Locale: </dt><dd className="inline">{user.preference?.locale ?? "EN"}</dd></div>
            <div><dt className="inline font-bold">Subjects: </dt><dd className="inline">{user._count.subjects}</dd></div>
            <div><dt className="inline font-bold">Tasks: </dt><dd className="inline">{user._count.tasks}</dd></div>
            <div><dt className="inline font-bold">Sessions: </dt><dd className="inline">{user._count.sessions}</dd></div>
            <div><dt className="inline font-bold">Goals: </dt><dd className="inline">{user._count.goals}</dd></div>
            <div><dt className="inline font-bold">Badges: </dt><dd className="inline">{user._count.badges}</dd></div>
            <div><dt className="inline font-bold">Insights: </dt><dd className="inline">{user._count.insights}</dd></div>
            <div><dt className="inline font-bold">AI tokens 30d: </dt><dd className="inline">{detail.aiTokens30d} ({detail.aiCalls30d} calls)</dd></div>
            <div><dt className="inline font-bold">Joined: </dt><dd className="inline">{new Date(user.createdAt).toLocaleDateString("en-GB")}</dd></div>
            <div><dt className="inline font-bold">Session ver.: </dt><dd className="inline">{user.sessionVersion}</dd></div>
          </dl>
        </div>
        <AdminUserActions userId={user.id} role={user.role} selfUserId={selfId} />
      </div>

      {activeTimers.length > 0 ? (
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">
            Running right now
          </h2>
          <ul className="admin-stack tight text-sm">
            {activeTimers.map((t) => (
              <li key={t.id}>
                ⏱️ {t.status} · {t.elapsedMinutes}/{t.plannedMinutes} min
                {t.room ? ` · room “${t.room.name}”` : ""} · started{" "}
                {new Date(t.startedAt).toLocaleString("en-GB")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ui-card overflow-x-auto p-0">
        <h2 className="admin-panel-heading inset">
          Tasks (latest {recentTasks.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted">
              <th className="p-3">Title</th><th className="p-3">Subject</th><th className="p-3">Status</th>
              <th className="p-3">Priority</th><th className="p-3">Due</th><th className="p-3">Completed</th>
            </tr>
          </thead>
          <tbody>
            {recentTasks.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="p-3 font-bold">{t.title}</td>
                <td className="p-3">{t.subject?.name ?? "—"}</td>
                <td className="p-3">{t.status}</td>
                <td className="p-3">{t.priority}</td>
                <td className="p-3 text-xs">{t.dueAt ? new Date(t.dueAt).toLocaleString("en-GB") : "—"}</td>
                <td className="p-3 text-xs">{t.completedAt ? new Date(t.completedAt).toLocaleString("en-GB") : "—"}</td>
              </tr>
            ))}
            {recentTasks.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-muted">No tasks.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="ui-card overflow-x-auto p-0">
        <h2 className="admin-panel-heading inset">
          Study sessions (latest {recentSessions.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted">
              <th className="p-3">Status</th><th className="p-3">Subject / task</th><th className="p-3">Started</th>
              <th className="p-3">Ended</th><th className="p-3">Minutes</th><th className="p-3">Focus</th><th className="p-3">Distracted</th>
            </tr>
          </thead>
          <tbody>
            {recentSessions.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-3 font-bold">{s.status}</td>
                <td className="p-3">{s.subject?.name ?? s.task?.title ?? "—"}</td>
                <td className="p-3 text-xs">{new Date(s.startedAt).toLocaleString("en-GB")}</td>
                <td className="p-3 text-xs">{s.endedAt ? new Date(s.endedAt).toLocaleString("en-GB") : "—"}</td>
                <td className="p-3">{Math.round(s.durationSeconds / 60)}</td>
                <td className="p-3">{s.focusScore ?? "—"}</td>
                <td className="p-3">{s.distractionCount}</td>
              </tr>
            ))}
            {recentSessions.length === 0 ? (
              <tr><td colSpan={7} className="p-4 text-center text-muted">No sessions.</td></tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">Recent AI jobs</h2>
          <ul className="admin-stack tight text-sm">
            {aiJobs.map((j) => (
              <li key={j.id}>
                <span className="font-bold">{j.type}</span> · {j.status}
                {j.errorCode ? ` (${j.errorCode})` : ""} · {new Date(j.createdAt).toLocaleString("en-GB")}
              </li>
            ))}
            {aiJobs.length === 0 ? <li className="text-muted">None.</li> : null}
          </ul>
        </section>
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">
            Manual reset requests & admin trail
          </h2>
          <ul className="admin-stack tight text-sm">
            {manualResets.map((r) => (
              <li key={r.id}>
                🆘 {r.status} · {new Date(r.createdAt).toLocaleString("en-GB")} · {r.details.slice(0, 60)}…
              </li>
            ))}
            {targetAudit.map((a) => (
              <li key={a.id}>
                🛡️ {a.action} by {a.admin?.name ?? "?"} · {new Date(a.createdAt).toLocaleString("en-GB")}
              </li>
            ))}
            {manualResets.length === 0 && targetAudit.length === 0 ? (
              <li className="text-muted">Nothing recorded.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
