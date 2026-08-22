import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/live", label: "Live activity" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/analytics", label: "Analytics" },
];

/**
 * The console guard itself. requireAdmin() verifies the ADMIN role against the database
 * on every request (never the JWT claim) and redirects non-admins to /dashboard, so
 * /admin is invisible to everyone else -- unlisted, unindexed, and DB-gated.
 *
 * Styling note: every class here is a hand-written one (shell.css) rather than Tailwind
 * utilities, because this page renders outside the student frame and this app's unlayered
 * cascade nullifies Tailwind's margin and heading utilities (see base.css).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <p className="eyebrow">Alex Study</p>
        <h1>Admin Console</h1>
        <span className="admin-header-user">
          {admin.name} · {admin.collegeId}
        </span>
        <Link href="/dashboard" className="btn btn-secondary btn-sm">
          Back to app
        </Link>
      </header>
      <nav className="admin-nav">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="btn btn-secondary btn-sm">
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
