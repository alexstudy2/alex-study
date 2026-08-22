import { createHash } from "node:crypto";

export const AI_PROMPT_VERSION = "phase10-v1";
export const AI_RETENTION_DAYS = 30;
export const AI_USER_DAILY_TOKEN_LIMIT = 40_000;
export const AI_GLOBAL_DAILY_TOKEN_LIMIT = 250_000;
/**
 * Raised from 6 once an exam plan could cost several OCR passes on top of the generation: a student
 * photographing a four-page فهرس and then generating twice would have hit the ceiling before the
 * nudges had a chance to run. The 40k-token user budget above is still the real governor -- this
 * count only stops a runaway loop of cheap calls.
 */
export const AI_USER_DAILY_JOB_LIMIT = 14;

const TYPE_DAILY_LIMITS: Record<string, number> = {
  DAILY_TIP: 2,
  WEEKLY_RECAP: 1,
  PERFORMANCE_DROP: 1,
  BURNOUT: 1,
  BEST_TIME: 1,
  /**
   * Raised from 2. A nudge is a broadcast the student reads once, but a plan proposal is meant to be
   * argued with -- raise the daily capacity, drop a rest day, re-shoot a page of the فهرس, generate
   * again -- and two a day made that impossible: one unlucky model reply in the morning left a single
   * attempt for the rest of the day. The governors that actually bound the cost are the 40k-token user
   * budget above and the 8-per-hour `generationRateLimit` on the route, both of which still hold.
   */
  EXAM_PLAN: 6,
  /** One per page of a photographed index, with room to re-shoot a blurry one. */
  EXAM_TOPICS: 8,
  /**
   * Quick-parse is the cheapest call in the app (650 completion tokens) and the most
   * iterative -- students type a sentence, check the draft, reword, retry. The governors
   * that bound it are the shared token budgets and the route's 8-per-hour limiter; the
   * per-type ceiling only exists here so it counts as tracked work like the rest.
   */
  TASK_PARSE: 12,
};

/** The per-type ceiling, exported so tests and callers name the limit instead of copying the number. */
export function typeDailyLimit(type: string) {
  return TYPE_DAILY_LIMITS[type] ?? 1;
}

export function assessAIAllowance(input: {
  globalTokens: number;
  userTokens: number;
  userJobs: number;
  typeJobs: number;
  type: string;
}) {
  if (input.globalTokens >= AI_GLOBAL_DAILY_TOKEN_LIMIT) return "ai_budget_exhausted" as const;
  if (input.userTokens >= AI_USER_DAILY_TOKEN_LIMIT) return "ai_budget_exhausted" as const;
  if (input.userJobs >= AI_USER_DAILY_JOB_LIMIT) return "ai_rate_limited" as const;
  if (input.typeJobs >= typeDailyLimit(input.type)) return "ai_rate_limited" as const;
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object" && !(value instanceof Date))
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  return value instanceof Date ? value.toISOString() : value;
}

export function hashAIInput(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

export function makeAIJobKey(type: string, value: unknown) {
  return `${type.toLowerCase()}:${hashAIInput(value)}`;
}
