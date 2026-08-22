/**
 * Runs once per Next.js server instance, before the first request is served.
 *
 * Importing the env contract here is what turns it from dead code into a gate: without
 * this hook the zod schema only executed when the two feature modules importing it were
 * first hit, so a production deploy missing DATABASE_URL or NEXTAUTH_SECRET would boot
 * "successfully" and fail per-request in confusing ways (audit H1). Now a bad environment
 * kills the boot with a named error instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/config/env");
  }
}
