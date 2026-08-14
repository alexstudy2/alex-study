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

export function requestIdentifier(
  headers: Headers | Record<string, string | string[] | undefined>,
) {
  const forwarded = headerValue(headers, "x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
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
export const searchRateLimit: RateLimitPolicy = {
  name: "user-search",
  limit: 60,
  windowSeconds: 60,
};
export const generationRateLimit: RateLimitPolicy = {
  name: "generation",
  limit: 8,
  windowSeconds: 60 * 60,
};
