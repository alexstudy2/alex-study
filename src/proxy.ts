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

/**
 * Content-Security-Policy, owned here rather than in next.config.ts (audit M1).
 *
 * Two reasons this moved into the proxy:
 *   1. A nonce must be fresh per request and known to the renderer. The proxy stamps the
 *      policy on the REQUEST headers -- Next.js parses it during SSR, extracts the
 *      `'nonce-…'` value, and applies it to every framework script it emits -- and
 *      mirrors it onto the response for the browser. next.config headers() cannot do the
 *      request half.
 *   2. Duplicate CSP headers are intersected by browsers, so emitting the policy in two
 *      places would silently reduce it to the stricter intersection. There is exactly one
 *      author now.
 *
 * Production uses `script-src 'nonce-X' 'strict-dynamic'`: inline and host-allowlisted
 * scripts are ignored by CSP3 browsers when strict-dynamic is present, so only scripts
 * carrying this request's nonce execute -- the perf bootstrap in layout.tsx gets the
 * nonce explicitly; framework chunks get it automatically. Dev keeps 'unsafe-inline'
 * plus React's required 'unsafe-eval'.
 *
 * style-src keeps 'unsafe-inline' deliberately: nonce-based styles cannot cover the app's
 * many `style={…}` attributes (that needs style-src-attr), and stripping them would gut
 * the UI for no attacker-value -- there are zero HTML-injection sinks today.
 *
 * Dynamic rendering is required for nonces; every HTML document here already renders
 * dynamically via the root layout's session lookup.
 */
function contentSecurityPolicy(): { header: string; nonce: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const upgrade = isDev ? "" : "; upgrade-insecure-requests";
  const header =
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ") + upgrade;
  return { header, nonce };
}

export function proxy(request: NextRequest) {
  if (unsafeMethods.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && !expectedOrigins(request).has(origin)) {
      return NextResponse.json({ error: "cross_origin_request" }, { status: 403 });
    }
  }

  /* Documents need a CSP with a per-request nonce; API responses get the same policy for
     free (harmless on JSON). Static assets bypass this proxy entirely via the matcher. */
  const { header, nonce } = contentSecurityPolicy();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", header);
  /* Page-view analytics read this in the root layout -- middleware is the only place that
     reliably knows the pathname for a server component. */
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", header);
  return response;
}

/* Everything except build-output assets: documents, API routes, manifests. Static files
   neither execute scripts nor need the per-request cost of this proxy. */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
