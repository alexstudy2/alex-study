/**
 * One place that answers "what origin is this deployment actually served from?".
 *
 * The trap this exists to avoid: `NEXTAUTH_URL` is a hand-maintained value, and a
 * production environment that still carries the local `http://localhost:3000` will
 * happily hand that string to anything that builds an absolute URL -- emails that
 * link nowhere, redirects that walk the user off the site. Prefer the live request
 * whenever the caller has one; only fall back to environment variables for code
 * that runs without a request at all (cron jobs, background notification sends).
 */

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function isLocal(url: string) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

function normalise(value: string | undefined, { assumeHttps = false } = {}) {
  const raw = value?.trim().replace(/\/+$/, "");
  if (!raw) return null;
  const candidate = /^https?:\/\//i.test(raw) ? raw : assumeHttps ? `https://${raw}` : raw;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/**
 * The origin to use for absolute links.
 *
 * Pass the incoming `Request` whenever one is in scope -- it is the only source that
 * is correct on preview deployments, custom domains and localhost alike, with no
 * configuration to keep in sync.
 */
export function siteOrigin(request?: Request): string {
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      // Fall through to the environment chain below.
    }
  }

  const explicit = normalise(process.env.APP_URL);
  if (explicit) return explicit;

  const configured = normalise(process.env.NEXTAUTH_URL);
  /* A localhost value on a hosted deployment is a stale copy of someone's .env, not a
     deliberate choice -- ignore it rather than emailing people links to their own machine. */
  if (configured && !(process.env.VERCEL && isLocal(configured))) return configured;

  const vercel =
    normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL, { assumeHttps: true }) ??
    normalise(process.env.VERCEL_URL, { assumeHttps: true });
  if (vercel) return vercel;

  return "http://localhost:3000";
}
