import { createHash } from "node:crypto";

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();
let callsSinceCleanup = 0;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function headerValue(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
) {
  if (headers instanceof Headers) return headers.get(name);
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Identity for pre-auth rate limits.
 *
 * History (audit M3): this used to take the FIRST x-forwarded-for entry, which is the
 * one header an attacker fully controls -- any client can ship `X-Forwarded-For:
 * <random>` and defeat every IP budget by rotation. Proxies APPEND the address they saw,
 * so the truthful client address sits at the END of the chain, one hop back per trusted
 * proxy layer (TRUSTED_PROXY_COUNT, default 1 -- the usual single edge proxy / Vercel
 * edge). Platform headers remain as fallbacks for chains we cannot reason about.
 *
 * Residual risk, documented rather than hidden: on a deployment with NO proxy at all, a
 * lone spoofed XFF entry is indistinguishable from an honest one -- nothing in the HTTP
 * contract marks provenance. Set TRUSTED_PROXY_COUNT to match the actual proxy depth.
 */
export function requestIdentifier(
  headers: Headers | Record<string, string | string[] | undefined>,
) {
  const forwarded = headerValue(headers, "x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const parsed = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10);
      const trusted = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      return hops[Math.max(0, hops.length - trusted)];
    }
  }
  return (
    headerValue(headers, "cf-connecting-ip") ||
    headerValue(headers, "x-real-ip") ||
    "anonymous"
  );
}

function memoryIncrement(key: string, now: number, windowSeconds: number) {
  callsSinceCleanup += 1;
  if (callsSinceCleanup >= 100) {
    callsSinceCleanup = 0;
    for (const [bucketKey, bucket] of memoryBuckets) {
      if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey);
    }
  }
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryBuckets.set(key, next);
    return next;
  }
  current.count += 1;
  return current;
}

async function upstashIncrement(key: string, windowSeconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSeconds + 1],
      ]),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(result[0]?.result);
    return Number.isFinite(count) ? count : null;
  } catch {
    return null;
  }
}

export async function checkRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
  now = Date.now(),
) {
  const windowStart = Math.floor(now / (policy.windowSeconds * 1000));
  const key = `alex-study:rate:${policy.name}:${windowStart}:${digest(identifier)}`;
  const remoteCount = await upstashIncrement(key, policy.windowSeconds);
  const count = remoteCount ?? memoryIncrement(key, now, policy.windowSeconds).count;
  const resetAt = (windowStart + 1) * policy.windowSeconds * 1000;
  return {
    allowed: count <= policy.limit,
    count,
    limit: policy.limit,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export async function enforceRateLimit(
  request: Request,
  policy: RateLimitPolicy,
  identifier = requestIdentifier(request.headers),
) {
  const decision = await checkRateLimit(identifier, policy);
  if (decision.allowed) return null;
  return Response.json(
    { error: "rate_limited", retryAfterSeconds: decision.retryAfterSeconds },
    {
      status: 429,
      headers: {
        "Retry-After": String(decision.retryAfterSeconds),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
      },
    },
  );
}

export function clearMemoryRateLimits() {
  memoryBuckets.clear();
}

export const authRateLimit: RateLimitPolicy = { name: "auth", limit: 12, windowSeconds: 15 * 60 };
export const registrationRateLimit: RateLimitPolicy = {
  name: "registration",
  limit: 5,
  windowSeconds: 60 * 60,
};
export const recoveryRateLimit: RateLimitPolicy = {
  name: "recovery",
  limit: 5,
  windowSeconds: 60 * 60,
};

/**
 * Timing-uniformity aid for account-recovery miss paths (audit L3): an unknown college ID
 * currently answers instantly while a known one pays DB-write + SMTP latency, so response
 * TIME leaks existence. Call this before the generic success response on miss branches --
 * it cannot make the paths identical, but it removes the loudest signal.
 */
export async function recoveryMissDelay() {
  const ms = 150 + Math.random() * 250;
  await new Promise((resolve) => setTimeout(resolve, ms));
}
export const searchRateLimit: RateLimitPolicy = {
  name: "user-search",
  limit: 60,
  windowSeconds: 60,
};
/* Whole-collection reads (analytics windows, whole-college leaderboard scans, calendar,
   insights). Generous for real navigation -- a dashboard load is a handful of calls --
   but bounded so scripted scraping pays per request instead of riding free (audit L5). */
export const readRateLimit: RateLimitPolicy = {
  name: "reads",
  limit: 60,
  windowSeconds: 60,
};
/* Lobby chat is the one unbounded write-per-member surface; 20/min keeps it human. */
export const chatRateLimit: RateLimitPolicy = {
  name: "lobby-chat",
  limit: 20,
  windowSeconds: 60,
};
/* Every send here triggers an outbound email or a peer notification -- challenge invites,
   friend requests, accountability invites (audit L5's email-bomb channel). */
export const inviteRateLimit: RateLimitPolicy = {
  name: "invites",
  limit: 10,
  windowSeconds: 60 * 60,
};
export const generationRateLimit: RateLimitPolicy = {
  name: "generation",
  limit: 8,
  windowSeconds: 60 * 60,
};
