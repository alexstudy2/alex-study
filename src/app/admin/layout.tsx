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
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell min-h-screen p-4 md:p-8">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <p className="eyebrow">Alex Study</p>
        <h1 className="text-2xl font-extrabold">Admin Console</h1>
        <span className="ml-auto text-sm text-muted">
          {admin.name} · {admin.collegeId}
        </span>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">
          Back to app
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
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
