import Link from "next/link";
import { getAnalytics } from "@/lib/admin/queries";
import { SimpleBar, SimpleLine } from "@/components/admin/charts";

export default async function AdminAnalyticsPage() {
  const data = await getAnalytics(30);
  return (
    <div className="admin-stack">
      <p className="text-xs text-muted">All series cover the last {data.days} days, bucketed by Cairo day.</p>

      <section className="ui-card p-4">
        <h2 className="admin-panel-heading">
          Focus minutes per day (all users)
        </h2>
        <SimpleLine data={data.minutesDaily} xKey="day" yKey="minutes" label="Minutes" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">Page views per day</h2>
          <SimpleLine data={data.viewsDaily} xKey="day" yKey="count" label="Views" />
        </section>
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">Tasks completed per day</h2>
          <SimpleBar data={data.completionsDaily} xKey="day" yKey="count" label="Tasks" />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">AI tokens per day</h2>
          <SimpleBar data={data.tokensDaily} xKey="day" yKey="tokens" label="Tokens" />
        </section>
        <section className="ui-card p-4">
          <h2 className="admin-panel-heading">
            When students study (sessions by hour, Cairo)
          </h2>
          <SimpleBar
            data={data.hourHistogram.map((h) => ({ ...h, hour: `${h.hour}:00` }))}
            xKey="hour"
            yKey="sessions"
            label="Sessions"
          />
        </section>
      </div>

      <section className="ui-card p-4">
        <h2 className="admin-panel-heading">
          Top focus hours · last {data.days}d
        </h2>
        <ol className="grid gap-2 md:grid-cols-2">
          {data.topUsers.map((t, i) => (
            <li key={t.user.id} className="flex items-center gap-2 text-sm">
              <span className="w-5 font-extrabold text-muted">{i + 1}.</span>
              <Link href={`/admin/users/${t.user.id}`} className="font-bold underline">
                {t.user.name}
              </Link>
              <span className="font-mono text-xs text-muted">{t.user.collegeId}</span>
              <span className="admin-row-end font-bold">{t.hours} h</span>
            </li>
          ))}
          {data.topUsers.length === 0 ? (
            <li className="text-sm text-muted">No completed sessions yet.</li>
          ) : null}
        </ol>
      </section>
    </div>
  );
}
