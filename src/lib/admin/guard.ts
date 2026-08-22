import "server-only";

import { prisma } from "@/lib/db/prisma";
import { captureError } from "@/lib/observability/logger";

/**
 * Admin authorization, resolved fresh from the database on every call.
 *
 * The JWT's `role` claim is frozen at sign-in for up to 30 days, so it must never be the
 * basis for a privileged decision (audit L6). Every page guard under /admin and every
 * mutation in /api/admin/* goes through here; anything that is not an ADMIN right now is
 * treated exactly like an anonymous visitor.
 *
 * Returns null instead of redirecting/throwing so callers pick the response shape
 * (pages redirect to /dashboard, APIs answer 403).
 */
export async function getAdmin() {
  try {
    const session = await getSessionSafe();
    if (!session?.user) return null;
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        collegeId: true,
        email: true,
        role: true,
        sessionVersion: true,
      },
    });
    if (!row || row.role !== "ADMIN") return null;
    // Same revocation contract as apiUser(): a bumped sessionVersion strands old cookies.
    const tokenSv = (session.user as { sv?: number }).sv;
    if (
      row.sessionVersion !== 0 &&
      tokenSv !== undefined &&
      tokenSv !== row.sessionVersion
    )
      return null;
    return { id: row.id, name: row.name, collegeId: row.collegeId };
  } catch (error) {
    captureError("admin.guard", error);
    return null;
  }
}

async function getSessionSafe() {
  const { getSession } = await import("@/lib/auth/session");
  return getSession();
}

/** Standard denial payloads for admin APIs. */
export function adminForbidden() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}
