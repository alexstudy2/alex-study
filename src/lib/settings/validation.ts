import { z } from "zod";
import {
  AMBIENT_VOLUME,
  FOCUS_MINUTES,
  LONG_BREAK_MINUTES,
  POMODOROS_BEFORE_LONG_BREAK,
  SHORT_BREAK_MINUTES,
} from "@/lib/settings/limits";

export const STUDY_MOOD_ENUM = ["NOTEBOOK", "SAKURA", "COSMIC", "AURORA", "SUNSET"] as const;

/* The material system, orthogonal to the mood. Kept next to STUDY_MOOD_ENUM because the
   preferences PATCH body carries both and they are validated by the same schema. */
export const STUDY_SKIN_ENUM = ["ATLAS", "DOODLE"] as const;

export const profileSettingsSchema = z
  .object({
    /* Same control-char ban as the register-time name schema (audit L8) -- this module
       cannot import it from auth/validation without a cycle, so mirror the rule. */
    name: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[^\u0000-\u001f\u007f]*$/, "Control characters are not allowed in names")
      .optional(),
    academicYear: z.coerce.number().int().min(1).max(6).optional(),
    email: z.union([z.literal(""), z.string().trim().email()]).optional(),
    locale: z.enum(["EN", "AR"]).optional(),
    /* Required by the server only when the request actually changes the email address
       (audit L17 interim): re-authenticate before moving where recovery mail goes. */
    currentPassword: z.string().min(1).max(128).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const studyPreferencesSchema = z
  .object({
    studyMood: z.enum(STUDY_MOOD_ENUM).optional(),
    skin: z.enum(STUDY_SKIN_ENUM).optional(),
    defaultFocusMinutes: z.coerce
      .number()
      .int()
      .min(FOCUS_MINUTES.min)
      .max(FOCUS_MINUTES.max)
      .optional(),
    defaultShortBreakMinutes: z.coerce
      .number()
      .int()
      .min(SHORT_BREAK_MINUTES.min)
      .max(SHORT_BREAK_MINUTES.max)
      .optional(),
    defaultLongBreakMinutes: z.coerce
      .number()
      .int()
      .min(LONG_BREAK_MINUTES.min)
      .max(LONG_BREAK_MINUTES.max)
      .optional(),
    pomodorosBeforeLongBreak: z.coerce
      .number()
      .int()
      .min(POMODOROS_BEFORE_LONG_BREAK.min)
      .max(POMODOROS_BEFORE_LONG_BREAK.max)
      .optional(),
    autoStartBreaks: z.boolean().optional(),
    autoStartFocus: z.boolean().optional(),
    ambientSound: z.enum(["off", "rain", "brown"]).nullable().optional(),
    ambientVolume: z.coerce
      .number()
      .int()
      .min(AMBIENT_VOLUME.min)
      .max(AMBIENT_VOLUME.max)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("DELETE"),
});
