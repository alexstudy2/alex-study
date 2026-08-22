import Link from "next/link";
import { listUsers } from "@/lib/admin/queries";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { users, total, pages, page: current } = await listUsers({ q, page });

  return (
    <div className="space-y-4">
      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, or college ID…"
          className="doodle-input min-w-0 flex-1"
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      <p className="text-xs text-muted">
        {total} user{total === 1 ? "" : "s"} · page {current}/{pages}
      </p>

      <div className="ui-card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted">
              <th className="p-3">User</th>
              <th className="p-3">College ID</th>
              <th className="p-3">Year</th>
              <th className="p-3">Role</th>
              <th className="p-3">Tasks</th>
              <th className="p-3">Sessions</th>
              <th className="p-3">Focus h</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link href={`/admin/users/${u.id}`} className="font-bold underline">
                    {u.name}
                  </Link>
                  {u.email ? <span className="block text-xs text-muted">{u.email}</span> : null}
                </td>
                <td className="p-3 font-mono text-xs">{u.collegeId}</td>
                <td className="p-3">{u.academicYear}</td>
                <td className="p-3">
                  <span className={u.role === "ADMIN" ? "font-extrabold" : ""}>{u.role}</span>
                </td>
                <td className="p-3">{u._count.tasks}</td>
                <td className="p-3">{u._count.sessions}</td>
                <td className="p-3">{u.minutes}</td>
                <td className="p-3 text-xs">{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
                <td className="p-3 text-xs">
                  {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString("en-GB") : "—"}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted">
                  No matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <nav className="flex gap-2">
        {current > 1 ? (
          <Link
            href={`/admin/users?page=${current - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="btn btn-secondary btn-sm"
          >
            ← Previous
          </Link>
        ) : null}
        {current < pages ? (
          <Link
            href={`/admin/users?page=${current + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className="btn btn-secondary btn-sm"
          >
            Next →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
