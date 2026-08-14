import { z } from "zod";

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
export const recurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({
    frequency: z.literal("DAILY"),
    interval: z.coerce.number().int().min(1).max(30).default(1),
  }),
  z.object({
    frequency: z.literal("WEEKLY"),
    interval: z.coerce.number().int().min(1).max(12).default(1),
    weekDays: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  }),
]);

const optionalDate = z
  .union([z.string().datetime({ offset: true }), z.literal(""), z.null()])
  .optional();
export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  notes: z.string().trim().max(5000).nullish(),
  subjectId: z.string().uuid().nullish(),
  parentTaskId: z.string().uuid().nullish(),
  priority: taskPrioritySchema.default("MEDIUM"),
  status: taskStatusSchema.default("TODO"),
  dueAt: optionalDate,
  estimatedMinutes: z.coerce.number().int().min(5).max(1440).nullish(),
  recurrenceRule: recurrenceSchema.nullish(),
});

export const taskPatchSchema = taskInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0);
export const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colorToken: z.enum(["teal", "coral", "amber", "violet", "sky", "rose", "slate"]).default("teal"),
});
export const reorderSchema = z.object({ taskIds: z.array(z.string().uuid()).min(1).max(200) });
export const bulkSchema = z
  .object({
    taskIds: z.array(z.string().uuid()).min(1).max(200),
    action: z.enum(["COMPLETE", "REOPEN", "DELETE", "PRIORITY"]),
    priority: taskPrioritySchema.optional(),
  })
  .refine((value) => value.action !== "PRIORITY" || Boolean(value.priority));
export const parseTaskSchema = z.object({
  text: z.string().trim().min(3).max(1000),
  locale: z.enum(["en", "ar"]).default("en"),
});
export const acceptDraftSchema = taskInputSchema.partial();

export type TaskInput = z.infer<typeof taskInputSchema>;
export type RecurrenceRule = z.infer<typeof recurrenceSchema>;
