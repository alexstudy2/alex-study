import { z } from "zod";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";
import {
  EXAM_ITEM_KINDS,
  MAX_IMAGE_BYTES,
  MAX_TOPICS,
  QUESTION_STRATEGIES,
  TOPIC_CONFIDENCES,
  TOPIC_WEIGHTS,
  renderSyllabusText,
} from "./topics";

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * One proposal is capped at this many items. It was 60, which is two a day for a month; folding
 * question practice into every study day roughly doubles the count, and a plan rejected wholesale
 * for having 61 items is the worst possible failure -- the student sees a 503 for a good plan.
 * The prompt asks for at most four items a day, so this only bites on very long windows.
 */
export const MAX_PLAN_ITEMS = 100;

/** A photographed فهرس, after the client downscales it. The cap lives in ./topics.ts, which the
 * scanner also imports, so the browser shrinks to the same number this rejects on. */
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Decoded byte length of a base64 payload, without allocating the buffer to find out. */
function base64Bytes(dataUrl: string) {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

/**
 * A topic as the composer sends it. `weight` and `confidence` are the difference between a topic
 * list and "just lines": how much material a topic holds and how shaky the student feels about it
 * are precisely what the plan should be shaped around, and neither is guessable from a title.
 */
export const examTopicSchema = z.object({
  title: z.string().trim().min(2).max(160),
  chapter: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((value) => value || null),
  weight: z.enum(TOPIC_WEIGHTS).default("NORMAL"),
  confidence: z.enum(TOPIC_CONFIDENCES).default("OK"),
});

export const examPlanGenerateSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    examAt: z
      .union([z.iso.datetime({ offset: true }), dateOnlySchema])
      .transform((value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? plannedDateToUtc(value).toISOString() : value,
      ),
    /**
     * Optional now that topics exist, but still accepted: pasting a blob is a legitimate way to
     * describe a syllabus, and it keeps every request that worked before this change working.
     */
    syllabusText: z.string().trim().min(20).max(12_000).optional(),
    topics: z.array(examTopicSchema).max(MAX_TOPICS).default([]),
    questionStrategy: z.enum(QUESTION_STRATEGIES).default("INTEGRATED"),
    dailyCapacityMinutes: z.coerce.number().int().min(30).max(600).default(180),
    /**
     * Weekday numbers (0 = Sunday, matching `Date#getDay`) the student wants left clear. Seven rest
     * days would leave nowhere to put the plan, so six is the cap.
     */
    restDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .max(6)
      .default([])
      .transform((days) => [...new Set(days)].sort((left, right) => left - right)),
  })
  .refine((value) => value.topics.length > 0 || Boolean(value.syllabusText), {
    message: "Add at least one topic, or paste your syllabus",
    path: ["topics"],
  })
  /**
   * Topics collapse into the same `syllabusText` the feature already stored, hashed and prompted
   * with, so retention, the 30-day purge and the 15-minute re-use cache need no changes at all.
   * Topics win when both are present -- the composer is the source of truth once it has rows.
   */
  .transform((value) => ({
    ...value,
    syllabusText: value.topics.length
      ? renderSyllabusText(value.topics)
      : (value.syllabusText as string),
  }));

export const extractTopicsSchema = z.object({
  image: z
    .string()
    .regex(IMAGE_DATA_URL, "Upload a PNG, JPEG or WebP image")
    .refine((value) => base64Bytes(value) <= MAX_IMAGE_BYTES, "That image is too large"),
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
        /** Defaulted rather than required: an older prompt's reply is a plan of study blocks. */
        kind: z.enum(EXAM_ITEM_KINDS).default("STUDY"),
      }),
    )
    .min(1)
    .max(MAX_PLAN_ITEMS),
});

const editableItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(180),
  notes: z.string().trim().max(2_000).nullable().default(null),
  subjectId: z.string().uuid().nullable().default(null),
  plannedDate: dateOnlySchema,
  estimatedMinutes: z.coerce.number().int().min(15).max(360),
  sortOrder: z.coerce.number().int().min(0).max(1_000),
  kind: z.enum(EXAM_ITEM_KINDS).default("STUDY"),
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
    items: z.array(editableItemSchema).max(MAX_PLAN_ITEMS).optional(),
    removeItemIds: z.array(z.string().uuid()).max(MAX_PLAN_ITEMS).optional(),
  })
  .refine((value) => Object.values(value).some((part) => part !== undefined));

export const acceptExamPlanSchema = z.object({
  itemIds: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_PLAN_ITEMS)
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
export type ExamTopicInput = z.infer<typeof examTopicSchema>;
