import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * One page-visit record per real document navigation.
 *
 * Counting rules chosen for honesty over volume:
 *   - Only `sec-fetch-dest: document` requests are recorded. RSC prefetches and client
 *     fetch()es also execute this layout code but arrive with other destinations; without
 *     this filter, hovering ten links would count ten visits.
 *   - /api and /admin paths are excluded -- API traffic is not a "visit", and the admin
 *     console should not inflate the product numbers it is looking at.
 *   - Recording is best-effort and swallows its own errors: analytics may never break
 *     rendering, even if the database is briefly unhappy.
 */
export async function recordPageView(userId?: string) {
  try {
    const h = await headers();
    if (h.get("sec-fetch-dest") !== "document") return;
    const path = h.get("x-pathname") ?? "";
    if (!path || path.startsWith("/api") || path.startsWith("/admin")) return;
    await prisma.pageView.create({
      data: {
        userId: userId ?? null,
        path,
        referrer: h.get("referer")?.slice(0, 500) ?? null,
        userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
      },
    });
  } catch {
    // Intentionally silent -- see module comment.
  }
}
