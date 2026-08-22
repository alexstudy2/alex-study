import { prisma } from "@/lib/db/prisma";
import { captureError } from "@/lib/observability/logger";

/**
 * Uptime-probe target (audit M6: the ops runbook said to monitor, but there was nothing
 * to point a monitor at). Deliberately unauthenticated -- it exposes only an ok flag and
 * a status code, never row data or error strings.
 *
 * The 2s budget keeps a wedged connection pool from hanging load balancers: past it we
 * report unhealthy rather than slow.
 */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db ping timeout")), 2000)),
    ]);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    captureError("health", error);
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
