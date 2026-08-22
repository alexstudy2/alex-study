import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * The authenticated caller, or null.
 *
 * Since T1.4 this is also where server-side session revocation lives: the JWT carries
 * the `sv` counter it was issued against, and here it is compared against the user's
 * current `sessionVersion`. A password reset bumps the column, so every outstanding
 * cookie stops resolving to a user on their very next request.
 *
 * Legacy grace: tokens issued before the column existed carry no `sv`. They are accepted
 * only against version 0 (a user who has not reset their password since the feature
 * shipped) -- so deploying this does not sign everyone out, while any reset immediately
 * strands both legacy and versioned old cookies.
 */
export async function apiUser() {
  const session = await getSession();
  const candidate = session?.user;
  if (!candidate) return null;
  /* Deliberately NOT caught: a database outage here must surface as a 500 (which clients
     retry) rather than masquerade as "not signed in" -- only a version mismatch below may
     answer that question. */
  const row = await prisma.user.findUnique({
    where: { id: candidate.id },
    select: { sessionVersion: true },
  });
  if (!row) return null;
  if (candidate.sv === undefined ? row.sessionVersion !== 0 : candidate.sv !== row.sessionVersion)
    return null;
  return candidate;
}

/* Shared response helpers -- these are the canonical definitions; several route families
   (users, sessions, ...) re-export them from here rather than duplicating them. */
export function invalid(fields?: unknown) {
  return Response.json({ error: "invalid_request", fields }, { status: 400 });
}
export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
/* Authenticated but not allowed here -- used for membership/role gates so a signed-in
   student isn't told "not signed in" (audit L7). */
export function forbidden() {
  return Response.json({ error: "forbidden" }, { status: 403 });
}
export function notFound() {
  return Response.json({ error: "not_found" }, { status: 404 });
}
