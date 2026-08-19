import { z } from "zod";
import { dayKeySpan, MAX_PLAN_DAYS } from "./dates";

/**
 * Plan Forum request shapes. Mirrors src/lib/goals/validation.ts: a base object, one refined
 * schema for POST, and a `.partial()` refinement for PATCH.
 */

/**
 * A calendar date with no time and no zone, which is what a plan is made of. `z.iso.datetime()`
 * -- used by the goals and sessions schemas -- would demand an instant here and re-open the
 * question of whose midnight it is; the day keys go through the Cairo helpers in ./dates instead.
 */
const dayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Not a real date");

const planFields = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  startDate: dayKey,
  endDate: dayKey,
});

/** The two fields the period refinements read. Both optional, because PATCH may send neither. */
type PeriodBounds = { startDate?: string; endDate?: string };

/**
 * Both bounds are checked here rather than in the route, so the create and the period edit cannot
 * disagree about what a legal span is. String comparison is enough for ordering: `YYYY-MM-DD`
 * sorts lexicographically exactly as it sorts chronologically.
 *
 * Constrained to `ZodType<PeriodBounds>` rather than `ZodTypeAny`: with `any` the callbacks receive
 * an `unknown` and the only way to read `startDate` is a cast, which would also let this be applied
 * to a schema that has no period at all.
 */
const withPeriodBounds = <T extends z.ZodType<PeriodBounds>>(schema: T) =>
  schema
    .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
      message: "The plan must end on or after it starts",
      path: ["endDate"],
    })
    .refine(
      (value) => {
        if (!value.startDate || !value.endDate) return true;
        return dayKeySpan(value.startDate, value.endDate) <= MAX_PLAN_DAYS;
      },
      { message: `A plan can cover at most ${MAX_PLAN_DAYS} days`, path: ["endDate"] },
    );

export const planInputSchema = withPeriodBounds(planFields);

/**
 * Editing a period is all-or-nothing: one bound alone cannot be validated against the other
 * without reading the row, and a half-checked range is how an inverted plan gets stored. The
 * refinement therefore requires both keys or neither.
 */
export const planPatchSchema = withPeriodBounds(
  planFields
    .partial()
    .extend({ visibility: z.enum(["PRIVATE", "CLASS"]).optional() })
    .refine((value) => Object.keys(value).length > 0, "Nothing to update")
    .refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
      message: "Change both dates together",
      path: ["endDate"],
    }),
);

export const planItemInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  /** Typed or picked from the datalist -- one field either way. Resolved to a course server-side. */
  subjectLabel: z.string().trim().min(1).max(60),
  dayDate: dayKey,
});

export const planItemPatchSchema = planItemInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const copyToTasksSchema = z.object({ dayDate: dayKey });

export type PlanInput = z.infer<typeof planInputSchema>;
export type PlanItemInput = z.infer<typeof planItemInputSchema>;
