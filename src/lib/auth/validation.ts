import { z } from "zod";
import {
  FOCUS_MINUTES,
  LONG_BREAK_MINUTES,
  SHORT_BREAK_MINUTES,
} from "@/lib/settings/limits";
import { STUDY_MOOD_ENUM } from "@/lib/settings/validation";

export const collegeIdSchema = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9-]+$/);

/**
 * What the sign-up wizard's preferences step collects.
 *
 * Every field is defaulted to the same value as its column default on `UserPreference`
 * (prisma/schema.prisma), so this whole object is spreadable straight into
 * `preference: { create: ... }` whether or not the user touched the step -- and
 * `registerSchema` can carry it as `.prefault({})`, which keeps a payload from an older
 * client (a flat form with no `preferences` key at all) registering exactly as before.
 *
 * Bounds come from lib/settings/limits.ts, shared with `studyPreferencesSchema` so the
 * wizard cannot accept a value the Settings page would later reject.
 */
export const signupPreferencesSchema = z
  .object({
    studyMood: z.enum(STUDY_MOOD_ENUM).default("NOTEBOOK"),
    defaultFocusMinutes: z.coerce
      .number()
      .int()
      .min(FOCUS_MINUTES.min)
      .max(FOCUS_MINUTES.max)
      .default(FOCUS_MINUTES.default),
    defaultShortBreakMinutes: z.coerce
      .number()
      .int()
      .min(SHORT_BREAK_MINUTES.min)
      .max(SHORT_BREAK_MINUTES.max)
      .default(SHORT_BREAK_MINUTES.default),
    defaultLongBreakMinutes: z.coerce
      .number()
      .int()
      .min(LONG_BREAK_MINUTES.min)
      .max(LONG_BREAK_MINUTES.max)
      .default(LONG_BREAK_MINUTES.default),
    emailNotifications: z.boolean().default(true),
    inAppNotifications: z.boolean().default(true),
    accountabilityNotifications: z.boolean().default(true),
    challengeNotifications: z.boolean().default(true),
    aiInsightNotifications: z.boolean().default(true),
    shareFullNameOnCards: z.boolean().default(false),
  })
  /* A long break shorter than the short one is a combination the ranges allow individually
     and nothing downstream would ever make sense of. */
  .refine((value) => value.defaultLongBreakMinutes >= value.defaultShortBreakMinutes, {
    message: "The long break cannot be shorter than the short break",
    path: ["defaultLongBreakMinutes"],
  });

export const registerSchema = z.object({
  name: z.string().trim().min(3).max(100),
  collegeId: collegeIdSchema,
  academicYear: z.coerce.number().int().min(1).max(6),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  password: z.string().min(8).max(128),
  locale: z.enum(["EN", "AR"]).default("EN"),
  /* `.prefault` rather than `.default`: zod 4 types `.default` against the *output* type, and
     the output here has every field required, so `.default({})` would not typecheck. `.prefault`
     feeds `{}` in as input and lets each field's own default fill it -- which is the behaviour
     that keeps an older flat payload (no `preferences` key at all) registering unchanged. */
  preferences: signupPreferencesSchema.prefault({}),
});

export const credentialsSchema = z.object({
  collegeId: collegeIdSchema,
  academicYear: z.coerce.number().int().min(1).max(6),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ collegeId: collegeIdSchema });
export const manualResetSchema = z.object({
  collegeId: collegeIdSchema,
  details: z.string().trim().min(20).max(1000),
});
