"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  role: string;
  /** The signed-in admin's own id -- self role-changes are blocked server-side too. */
  selfUserId: string;
};

type ActionResult = { ok?: boolean; generatedPassword?: string | null; error?: string };

/**
 * The privileged-action panel on a user's admin page. Every button POSTs to the single
 * audited /api/admin/actions endpoint; password values appear exactly once (in this
 * component, after generation) and are never stored in plaintext anywhere.
 */
export function AdminUserActions({ userId, role, selfUserId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [nextRole, setNextRole] = useState(role === "ADMIN" ? "STUDENT" : "ADMIN");

  const isSelf = userId === selfUserId;

  async function post(body: Record<string, unknown>, successText: string) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
      });
      const data = (await res.json()) as ActionResult;
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return null;
      }
      setMsg(successText);
      router.refresh();
      return data;
    } catch {
      setError("Network error");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function generatePassword() {
    if (!adminPassword) return setError("Enter YOUR admin password first.");
    const saved = customPassword;
    setCustomPassword("");
    const data = await post(
      { action: "SET_PASSWORD", adminPassword },
      "Password replaced. All of the user's sessions were logged out."
    );
    if (!saved) setGenerated(data?.generatedPassword ?? null);
    else {
      // Custom path never returns the value; echo what the admin chose once.
      setGenerated(saved);
    }
  }

  async function setPassword() {
    if (!adminPassword) return setError("Enter YOUR admin password first.");
    if (customPassword.length < 8) return setError("Custom password needs at least 8 characters.");
    await generatePassword();
  }

  async function forceLogout() {
    if (!window.confirm("Log this user out everywhere?")) return;
    await post({ action: "FORCE_LOGOUT" }, "All sessions invalidated.");
  }

  async function changeRole() {
    if (isSelf) return setError("You cannot change your own role (lockout protection).");
    if (!window.confirm(`Set role to ${nextRole}?`)) return;
    await post({ action: "SET_ROLE", role: nextRole }, `Role updated to ${nextRole}.`);
  }

  const field =
    "doodle-input w-full";
  return (
    <div className="ui-card space-y-4 p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted">
        Admin controls
      </h2>

      <label className="block space-y-1">
        <span className="field-label">Your admin password (re-authentication)</span>
        <input
          type="password"
          className={field}
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      <div className="space-y-2 rounded border border-dashed p-3">
        <p className="text-xs font-bold uppercase text-muted">Replace this user&apos;s password</p>
        <input
          type="text"
          className={field}
          placeholder="New password (leave empty to auto-generate)"
          value={customPassword}
          onChange={(e) => setCustomPassword(e.target.value)}
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={setPassword} className="btn btn-primary btn-sm">
            Set custom password
          </button>
          <button
            type="button"
            disabled={busy || Boolean(customPassword)}
            onClick={() => {
              setCustomPassword("");
              void generatePassword();
            }}
            className="btn btn-secondary btn-sm"
          >
            Generate strong password
          </button>
        </div>
        {generated ? (
          <div className="rounded bg-[var(--primary-subtle)] p-2">
            <p className="text-xs font-bold uppercase text-muted">Shown once — copy now</p>
            <code className="select-all break-all font-mono font-bold">{generated}</code>
            <button
              type="button"
              className="btn btn-ghost btn-sm ml-2"
              onClick={() => navigator.clipboard?.writeText(generated)}
            >
              Copy
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">The user is logged out everywhere; reset tokens are cleared.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="field-label">Change role</span>
          <select className="doodle-select" value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
            <option value="ADMIN">ADMIN</option>
            <option value="STUDENT">STUDENT</option>
          </select>
        </label>
        <button type="button" disabled={busy || nextRole === role} onClick={changeRole} className="btn btn-secondary btn-sm">
          Apply role
        </button>
        <button type="button" disabled={busy} onClick={forceLogout} className="btn btn-danger btn-sm ml-auto">
          Force logout everywhere
        </button>
      </div>

      {isSelf ? <p className="text-xs text-muted">Own role changes are blocked (lockout protection).</p> : null}
      {msg ? <p className="text-sm font-bold text-[var(--success)]">{msg}</p> : null}
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
