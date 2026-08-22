import Link from "next/link";
import { getOverview } from "@/lib/admin/queries";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="ui-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default async function AdminOverview() {
  const { stats, signups14, recentAudit } = await getOverview();
  const maxSignups = Math.max(1, ...signups14.map((s) => s.count));
  return (
    <div className="space-y-6">
      {stats.pendingResets > 0 ? (
        <div className="ui-card border-2 border-dashed p-4 text-sm font-bold">
          ⚠️ {stats.pendingResets} pending manual password-reset request(s) waiting in{" "}
          <Link href="/admin/logs?type=resets" className="underline">
            Logs → Reset requests
          </Link>
        </div>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">Users</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Total users" value={stats.usersTotal} />
          <Stat label="New (7d)" value={stats.usersNew7} />
          <Stat label="New (30d)" value={stats.usersNew30} />
          <Stat label="Active today" value={stats.activeUsersToday} />
          <Stat label="Views today" value={stats.viewsToday} hint={`${stats.views7} in 7d`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">
          Study work
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Tasks" value={stats.tasksTotal} hint={`${stats.completionRate}% done`} />
          <Stat label="Tasks completed" value={stats.tasksCompleted} />
          <Stat label="Sessions" value={stats.sessionsTotal} hint={`${stats.sessionsCompleted} completed`} />
          <Stat label="Focus minutes" value={stats.minutesTotal} hint={`${stats.minutesToday} today`} />
          <Stat label="Live timers" value={stats.timersActive} />
          <Stat label="Challenges live" value={stats.challengesActive} hint={`${stats.roomsOpen} open rooms`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-muted">AI</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
          <Stat label="AI jobs today" value={stats.aiJobsToday} />
          <Stat label="AI tokens today" value={stats.tokensToday} />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="ui-card p-4">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">
            Sign-ups · last 14 days
          </h2>
          {signups14.length === 0 ? (
            <p className="text-sm text-muted">No sign-ups yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {signups14.map((row) => (
                <li key={String(row.day)} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-muted">{new Date(row.day).toLocaleDateString("en-GB")}</span>
                  <span className="h-3 rounded bg-[var(--primary)] opacity-80" style={{ width: `${(row.count / maxSignups) * 100}%`, minWidth: 4 }} />
                  <span className="font-bold">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ui-card p-4">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-muted">
            Recent admin actions
          </h2>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-bold">{entry.action}</span>
                  <span className="text-muted">on</span>
                  <Link href={`/admin/users/${entry.targetUserId ?? ""}`} className="underline">
                    {entry.targetUserId?.slice(0, 8)}…
                  </Link>
                  <span className="text-muted">by {entry.admin?.name ?? "removed admin"}</span>
                  <span className="ml-auto text-xs text-muted">
                    {new Date(entry.createdAt).toLocaleString("en-GB")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
