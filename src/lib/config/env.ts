import { z } from "zod";
import { logWarn } from "@/lib/observability/logger";

/**
 * The boot-time environment contract.
 *
 * History lesson baked into this file's shape: it used to substitute friendly dev
 * fallbacks unconditionally -- including a hardcoded NEXTAUTH_SECRET whose value sat in
 * a public repo. A production deploy missing that var would have booted happily with
 * sessions anyone could forge (audit C1). The rule now:
 *
 *   - Credentials and connection strings (DATABASE_URL, NEXTAUTH_SECRET) are REQUIRED.
 *     In development a documented fallback keeps local setup frictionless; in production
 *     a missing value throws at boot via the zod schema -- fail fast beats fail open.
 *   - CRON_SECRET is required in production too: the job endpoints are fail-closed
 *     without it, but "app up, jobs silently dead forever" is precisely the silent
 *     degradation this file exists to prevent.
 *   - Everything else is optional; infra with graceful degradation (Upstash rate limits,
 *     SMTP mail, Groq AI) logs one boot warning when absent so operators see which
 *     subsystems are running degraded.
 *
 * This module is imported by src/instrumentation.ts, so the schema executes once per
 * server start before the first request is served -- not merely when the two feature
 * modules that happen to import it are first hit.
 */

const isProduction = process.env.NODE_ENV === "production";

/* Empty-string values (a copied `.env.example`) count as absent. */
const raw = {
  DATABASE_URL:
    process.env.DATABASE_URL ?? (isProduction ? undefined : "postgresql://localhost:5432/alex_study"),
  NEXTAUTH_SECRET:
    process.env.NEXTAUTH_SECRET ??
    (isProduction ? undefined : "development-only-change-this-secret-123456"),
  CRON_SECRET: process.env.CRON_SECRET || undefined,
  GROQ_API_KEY: process.env.GROQ_API_KEY || undefined,
  GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL || undefined,
};

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /* 32 bytes minimum: HS256 signing keys below this are brute-forceable. */
  NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET must be at least 32 characters")
    .optional(),
  /**
   * Overrides the multimodal model used to read a photographed syllabus. Optional and swappable
   * from `.env` on purpose: vision model ids on Groq come and go faster than releases here, and an
   * id that stops being served should cost one line in an env file, not a code change.
   */
  GROQ_VISION_MODEL: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
});

export const env = schema.parse(raw);

/* One-time boot warnings for optional infrastructure whose absence degrades features
   silently. Emitted at instrumentation time, once per server instance. */
if (isProduction) {
  if (!env.GROQ_API_KEY)
    logWarn("env", "GROQ_API_KEY unset: AI generation endpoints will report unavailable");
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN)
    logWarn("env", "Upstash unset: rate limiting degrades to per-instance memory maps");
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_APP_PASSWORD)
    logWarn("env", "SMTP unset: notification and password-recovery email will not deliver");
  if (!process.env.NEXTAUTH_URL && !process.env.AUTH_TRUST_HOST)
    logWarn("env", "Neither NEXTAUTH_URL nor AUTH_TRUST_HOST set: next-auth origin detection falls back to defaults");
}
