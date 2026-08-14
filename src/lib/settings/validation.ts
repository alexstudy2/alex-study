import { z } from "zod";

export const profileSettingsSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    academicYear: z.coerce.number().int().min(1).max(6).optional(),
    email: z.union([z.literal(""), z.string().trim().email()]).optional(),
    locale: z.enum(["EN", "AR"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const studyPreferencesSchema = z
  .object({
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
    defaultFocusMinutes: z.coerce.number().int().min(5).max(120).optional(),
    defaultShortBreakMinutes: z.coerce.number().int().min(1).max(30).optional(),
    defaultLongBreakMinutes: z.coerce.number().int().min(5).max(60).optional(),
    pomodorosBeforeLongBreak: z.coerce.number().int().min(1).max(12).optional(),
    autoStartBreaks: z.boolean().optional(),
    autoStartFocus: z.boolean().optional(),
    ambientSound: z.enum(["off", "rain", "brown"]).nullable().optional(),
    ambientVolume: z.coerce.number().int().min(0).max(100).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("DELETE"),
});
