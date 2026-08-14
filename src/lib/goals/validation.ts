import { z } from "zod";

export const goalMetricSchema = z.enum(["STUDY_MINUTES", "TASKS_COMPLETED"]);
export const goalPeriodSchema = z.enum(["WEEKLY", "MONTHLY", "CUSTOM"]);
export const goalStatusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]);

const goalFields = z.object({
  title: z.string().trim().min(1).max(160),
  subjectId: z.string().uuid().nullable().optional(),
  metric: goalMetricSchema,
  targetValue: z.coerce.number().int().min(1).max(100000),
  period: goalPeriodSchema,
  startsAt: z.iso.datetime(),
  deadline: z.iso.datetime(),
});

export const goalInputSchema = goalFields.refine(
  (value) => new Date(value.deadline) > new Date(value.startsAt),
  {
    message: "Deadline must be after the start date",
    path: ["deadline"],
  },
);

export const goalPatchSchema = goalFields
  .partial()
  .extend({ status: goalStatusSchema.optional() })
  .refine((value) => Object.keys(value).length > 0);
