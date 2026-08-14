import { createHash } from "node:crypto";

export const AI_PROMPT_VERSION = "phase10-v1";
export const AI_RETENTION_DAYS = 30;
export const AI_USER_DAILY_TOKEN_LIMIT = 40_000;
export const AI_GLOBAL_DAILY_TOKEN_LIMIT = 250_000;
export const AI_USER_DAILY_JOB_LIMIT = 6;

const TYPE_DAILY_LIMITS: Record<string, number> = {
  DAILY_TIP: 2,
  WEEKLY_RECAP: 1,
  PERFORMANCE_DROP: 1,
  BURNOUT: 1,
  BEST_TIME: 1,
  EXAM_PLAN: 2,
};

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
  if (input.typeJobs >= (TYPE_DAILY_LIMITS[input.type] ?? 1)) return "ai_rate_limited" as const;
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
