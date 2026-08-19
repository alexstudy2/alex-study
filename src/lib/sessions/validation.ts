import { z } from "zod";

export const timerModeSchema = z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]);
export const timerStartSchema = z.object({
  mode: timerModeSchema,
  durationSeconds: z
    .number()
    .int()
    .min(60)
    .max(4 * 60 * 60),
  taskId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(),
});
export const timerActionSchema = z.object({
  version: z.number().int().positive(),
  reflection: z.string().trim().max(1000).optional(),
});
/* `.nullable()` as well as `.optional()`, like taskId/subjectId above: the "I got distracted"
   button posts `{ note: null }` for the no-note case, and a bare `.optional()` accepts only
   `undefined`, so zod rejected every click with "expected string, received null" -> 400 -> "The
   timer could not be updated". The route already normalises with `parsed.data.note || null`, so
   null was always the shape it was written to take. */
export const distractionSchema = z.object({
  note: z.string().trim().max(240).nullable().optional(),
});
const manualSessionFields = z.object({
    taskId: z.string().uuid().nullable().optional(),
    subjectId: z.string().uuid().nullable().optional(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    plannedDurationSeconds: z
      .number()
      .int()
      .min(60)
      .max(12 * 60 * 60),
    distractionCount: z.number().int().min(0).max(999),
    reflection: z.string().trim().max(1000).optional(),
  });

export const manualSessionSchema = manualSessionFields.extend({
  distractionCount: z.number().int().min(0).max(999).default(0),
})
  .refine((value) => new Date(value.endedAt) > new Date(value.startedAt), {
    message: "End time must be after start time",
    path: ["endedAt"],
  });

export const sessionPatchSchema = manualSessionFields
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" })
  .refine(
    (value) => !value.startedAt || !value.endedAt || new Date(value.endedAt) > new Date(value.startedAt),
    { message: "End time must be after start time", path: ["endedAt"] },
  );
