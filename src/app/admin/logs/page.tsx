import Link from "next/link";
import {
  getAiJobLogs,
  getAuditLogs,
  getResetRequestLogs,
  getUsageLogs,
} from "@/lib/admin/queries";

const tabs = [
  { key: "audit", label: "Admin trail" },
  { key: "ai", label: "AI jobs" },
  { key: "usage", label: "AI usage (7d)" },
  { key: "resets", label: "Reset requests" },
] as const;

type Tab = (typeof tabs)[number]["key"];

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const type = (tabs.some((t) => t.key === sp.type) ? sp.type : "audit") as Tab;
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/logs?type=${t.key}`}
            className={`btn btn-sm ${type === t.key ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {type === "audit" ? <AuditTable /> : null}
      {type === "ai" ? <AiJobTable /> : null}
      {type === "usage" ? <UsageTable /> : null}
      {type === "resets" ? <ResetRequestsTable /> : null}
    </div>
  );
}

async function AuditTable() {
  const entries = await getAuditLogs();
  return (
    <div className="ui-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted">
            <th className="p-3">When</th>
            <th className="p-3">Action</th>
            <th className="p-3">Target</th>
            <th className="p-3">By admin</th>
            <th className="p-3">Meta</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="p-3 text-xs">{new Date(e.createdAt).toLocaleString("en-GB")}</td>
              <td className="p-3 font-bold">{e.action}</td>
              <td className="p-3">
                {e.targetUserId ? (
                  <Link href={`/admin/users/${e.targetUserId}`} className="underline">
                    {e.targetUserId.slice(0, 8)}…
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="p-3">{e.admin?.name ?? "(removed)"}</td>
              <td className="max-w-72 truncate p-3 font-mono text-xs">
                {e.meta ? JSON.stringify(e.meta) : "—"}
              </td>
            </tr>
          ))}
          {entries.length === 0 ? (
            <tr><td colSpan={5} className="p-6 text-center text-muted">No admin actions recorded yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

async function AiJobTable() {
  const jobs = await getAiJobLogs();
  return (
    <div className="ui-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted">
            <th className="p-3">When</th>
            <th className="p-3">User</th>
            <th className="p-3">Type</th>
            <th className="p-3">Status</th>
            <th className="p-3">Error</th>
            <th className="p-3">Tries</th>
            <th className="p-3">Model</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b last:border-0">
              <td className="p-3 text-xs">{new Date(j.createdAt).toLocaleString("en-GB")}</td>
              <td className="p-3">
                <Link href={`/admin/users/${j.user.id}`} className="underline">{j.user.name}</Link>
              </td>
              <td className="p-3 font-bold">{j.type}</td>
              <td className="p-3">{j.status}</td>
              <td className="p-3">{j.errorCode ?? "—"}</td>
              <td className="p-3">{j.attempts}</td>
              <td className="p-3 font-mono text-xs">{j.model}</td>
            </tr>
          ))}
          {jobs.length === 0 ? (
            <tr><td colSpan={7} className="p-6 text-center text-muted">No AI jobs yet.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

async function UsageTable() {
  const entries = await getUsageLogs();
  return (
    <div className="ui-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted">
            <th className="p-3">When</th>
            <th className="p-3">User</th>
            <th className="p-3">Operation</th>
            <th className="p-3">Tokens</th>
            <th className="p-3">In/Out</th>
            <th className="p-3">Model</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b last:border-0">
              <td className="p-3 text-xs">{new Date(e.occurredAt).toLocaleString("en-GB")}</td>
              <td className="p-3">
                {e.user ? (
                  <Link href={`/admin/users/${e.user.id}`} className="underline">{e.user.name}</Link>
                ) : (
                  "(deleted)"
                )}
              </td>
              <td className="p-3 font-bold">{e.operation}</td>
              <td className="p-3">{e.units}</td>
              <td className="p-3 text-xs">{e.inputUnits ?? "—"}/{e.outputUnits ?? "—"}</td>
              <td className="p-3 font-mono text-xs">{e.model ?? "—"}</td>
            </tr>
          ))}
          {entries.length === 0 ? (
            <tr><td colSpan={6} className="p-6 text-center text-muted">No usage in the last 7 days.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

async function ResetRequestsTable() {
  const requests = await getResetRequestLogs();
  return (
    <div className="ui-card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted">
            <th className="p-3">When</th>
            <th className="p-3">User</th>
            <th className="p-3">Contact</th>
            <th className="p-3">Status</th>
            <th className="p-3">Details</th>
            <th className="p-3">Reviewed by</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="p-3 text-xs">{new Date(r.createdAt).toLocaleString("en-GB")}</td>
              <td className="p-3">
                <Link href={`/admin/users/${r.user.id}`} className="underline">{r.user.name}</Link>
              </td>
              <td className="p-3 text-xs">{r.user.email ?? "no email"}</td>
              <td className="p-3 font-bold">{r.status}</td>
              <td className="max-w-96 truncate p-3">{r.details}</td>
              <td className="p-3 text-xs">{r.reviewedBy ?? "—"}</td>
            </tr>
          ))}
          {requests.length === 0 ? (
            <tr><td colSpan={6} className="p-6 text-center text-muted">Queue empty.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
