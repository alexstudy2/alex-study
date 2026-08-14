import { z } from "zod";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const examPlanGenerateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  examAt: z
    .union([z.iso.datetime({ offset: true }), dateOnlySchema])
    .transform((value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) ? plannedDateToUtc(value).toISOString() : value,
    ),
  syllabusText: z.string().trim().min(20).max(12_000),
});

export const generatedExamPlanSchema = z.object({
  overview: z.string().trim().min(1).max(1_000),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(180),
        notes: z.string().trim().max(2_000).nullable().default(null),
        subjectName: z.string().trim().max(80).nullable().default(null),
        plannedDate: dateOnlySchema,
        estimatedMinutes: z.number().int().min(15).max(360),
      }),
    )
    .min(1)
    .max(60),
});

const editableItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  notes: z.string().trim().max(2_000).nullable().default(null),
  subjectId: z.string().uuid().nullable().default(null),
  plannedDate: dateOnlySchema,
  estimatedMinutes: z.coerce.number().int().min(15).max(360),
  sortOrder: z.coerce.number().int().min(0).max(1_000),
});

export const examPlanPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    overview: z.string().trim().max(1_000).nullable().optional(),
    examAt: z
      .union([z.iso.datetime({ offset: true }), dateOnlySchema])
      .transform((value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? plannedDateToUtc(value).toISOString() : value,
      )
      .optional(),
    items: z.array(editableItemSchema).max(60).optional(),
    removeItemIds: z.array(z.string().uuid()).max(60).optional(),
  })
  .refine((value) => Object.values(value).some((part) => part !== undefined));

export const acceptExamPlanSchema = z.object({
  itemIds: z
    .array(z.string().uuid())
    .min(1)
    .max(60)
    .refine((ids) => new Set(ids).size === ids.length),
  confirmTaskCreation: z.literal(true),
});

export function examWindowError(examAt: Date, now = new Date()) {
  const minimum = now.getTime() + 6 * 60 * 60 * 1_000;
  const maximum = now.getTime() + 366 * 24 * 60 * 60 * 1_000;
  if (examAt.getTime() <= minimum) return "exam_too_soon";
  if (examAt.getTime() > maximum) return "exam_too_far";
  return null;
}

export function cairoDateKey(value: Date) {
  return toZonedTime(value, DEFAULT_TIMEZONE).toISOString().slice(0, 10);
}

export function plannedDateToUtc(value: string) {
  return fromZonedTime(`${value}T23:59:00`, DEFAULT_TIMEZONE);
}

export function proposalDatesAreValid(
  items: Array<{ plannedDate: string }>,
  examAt: Date,
  now = new Date(),
) {
  const earliest = cairoDateKey(now);
  const latest = cairoDateKey(examAt);
  return items.every((item) => item.plannedDate >= earliest && item.plannedDate <= latest);
}

export function deriveExamPlanStatus(input: {
  totalItems: number;
  acceptedItems: number;
  closed: boolean;
}) {
  if (input.totalItems > 0 && input.acceptedItems === input.totalItems) return "ACCEPTED" as const;
  if (input.acceptedItems > 0) return "PARTIALLY_ACCEPTED" as const;
  if (input.closed) return "REJECTED" as const;
  return "PROPOSED" as const;
}

export type ExamPlanGenerateInput = z.infer<typeof examPlanGenerateSchema>;
export type ExamPlanPatchInput = z.infer<typeof examPlanPatchSchema>;
export type GeneratedExamPlan = z.infer<typeof generatedExamPlanSchema>;
