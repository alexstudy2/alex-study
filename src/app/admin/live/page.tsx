import Link from "next/link";
import { getActivity } from "@/lib/admin/queries";

const tabs = [
  { key: "timers", label: "Running now" },
  { key: "sessions", label: "Sessions" },
  { key: "tasks", label: "Tasks" },
] as const;

const statusOptions: Record<string, { value: string; label: string }[]> = {
  timers: [],
  sessions: [
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "In progress / paused" },
    { value: "COMPLETED", label: "Completed" },
    { value: "ABANDONED", label: "Abandoned" },
  ],
  tasks: [
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "Open" },
    { value: "COMPLETED", label: "Completed" },
  ],
};

export default async function AdminLivePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; userId?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type = (["timers", "sessions", "tasks"].includes(sp.type ?? "") ? sp.type : "sessions")!;
  const status = (
    ["ALL", "ACTIVE", "COMPLETED", "ABANDONED"].includes(sp.status ?? "") ? sp.status : "ALL"
  ) as "ALL" | "ACTIVE" | "COMPLETED" | "ABANDONED";
  const page = Math.max(1, Number(sp.page) || 1);
  const data = await getActivity({
    type: type as "timers" | "sessions" | "tasks",
    status,
    userId: sp.userId || undefined,
    page,
  });
  const qs = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type, status, page: String(page), ...sp, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/admin/live?${params.toString()}`;
  };

  return (
    <div className="admin-stack snug">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={qs({ type: t.key, status: t.key === "tasks" ? "ALL" : "ALL", page: "1" })}
            className={`btn btn-sm ${type === t.key ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <nav className="flex flex-wrap gap-2 text-xs">
        {(statusOptions[type] ?? []).map((opt) => (
          <Link
            key={opt.value}
            href={qs({ status: opt.value === "ALL" ? "" : opt.value, page: "1" })}
            className={`underline ${status === opt.value ? "font-extrabold" : "text-muted"}`}
          >
            {opt.label}
          </Link>
        ))}
      </nav>

      <p className="text-xs text-muted">
        {data.total} row{data.total === 1 ? "" : "s"} Â· page {data.page}/{data.pages}
        {"timers" === type ? " Â· elapsed is a live snapshot at render time" : ""}
      </p>

      <div className="ui-card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <tbody>
            {data.type === "timers"
              ? data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-bold">
                      â±ï¸ {r.elapsedMinutes}/{r.plannedMinutes} min
                    </td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">{r.mode}</td>
                    <td className="p-3">
                      <Link href={`/admin/users/${r.user.id}`} className="underline">
                        {r.user.name}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted">{r.user.collegeId}</span>
                    </td>
                    <td className="p-3 text-xs">{r.roomName ?? "solo"}</td>
                    <td className="p-3 text-xs">started {new Date(r.startedAt).toLocaleString("en-GB")}</td>
                  </tr>
                ))
              : null}

            {data.type === "sessions"
              ? data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-bold">{r.status}</td>
                    <td className="p-3">
                      <Link href={`/admin/users/${r.user.id}`} className="underline">
                        {r.user.name}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted">{r.user.collegeId}</span>
                    </td>
                    <td className="p-3">{r.subject?.name ?? r.task?.title ?? "â€”"}</td>
                    <td className="p-3">{Math.round(r.durationSeconds / 60)} min</td>
                    <td className="p-3">focus {r.focusScore ?? "â€”"}</td>
                    <td className="p-3 text-xs">{new Date(r.startedAt).toLocaleString("en-GB")}</td>
                    <td className="p-3">
                      <Link href={`/admin/users/${r.user.id}`} className="text-xs underline">
                        profile â†’
                      </Link>
                    </td>
                  </tr>
                ))
              : null}

            {data.type === "tasks"
              ? data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-bold">{r.title}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3">{r.priority}</td>
                    <td className="p-3">
                      <Link href={`/admin/users/${r.user.id}`} className="underline">
                        {r.user.name}
                      </Link>{" "}
                      <span className="font-mono text-xs text-muted">{r.user.collegeId}</span>
                    </td>
                    <td className="p-3">{r.subject?.name ?? "â€”"}</td>
                    <td className="p-3 text-xs">
                      due {r.dueAt ? new Date(r.dueAt).toLocaleDateString("en-GB") : "â€”"}
                    </td>
                    <td className="p-3 text-xs">
                      done {r.completedAt ? new Date(r.completedAt).toLocaleDateString("en-GB") : "â€”"}
                    </td>
                  </tr>
                ))
              : null}

            {data.rows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-muted">Nothing here.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-2">
        {page > 1 ? (
          <Link href={qs({ page: String(page - 1) })} className="btn btn-secondary btn-sm">
            â† Previous
          </Link>
        ) : null}
        {page < data.pages ? (
          <Link href={qs({ page: String(page + 1) })} className="btn btn-secondary btn-sm">
            Next â†’
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
