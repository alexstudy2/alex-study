import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function expectedOrigins(request: NextRequest) {
  const origins = new Set<string>([request.nextUrl.origin]);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  if (host) origins.add(`${protocol}://${host.split(",")[0].trim()}`);
  const configured = process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Ignore malformed deployment configuration; the request origin remains authoritative.
    }
  }
  return origins;
}

export function proxy(request: NextRequest) {
  if (unsafeMethods.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && !expectedOrigins(request).has(origin)) {
      return NextResponse.json({ error: "cross_origin_request" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
