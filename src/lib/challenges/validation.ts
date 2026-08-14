import { z } from "zod";

export const challengeTypeSchema = z.enum([
  "TASK_COUNT",
  "STUDY_TIME",
  "SUBJECT_TASK_COUNT",
  "SUBJECT_STUDY_TIME",
]);
export const challengeResolutionSchema = z.enum(["TARGET_FIRST", "DEADLINE_LEADER"]);

export const challengeInputSchema = z
  .object({
    opponentId: z.string().uuid(),
    type: challengeTypeSchema,
    resolutionType: challengeResolutionSchema,
    targetValue: z.coerce.number().int().positive().max(20_000),
    subjectId: z.string().uuid().nullish(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    const subjectType = value.type.startsWith("SUBJECT_");
    if (subjectType && !value.subjectId)
      context.addIssue({ code: "custom", path: ["subjectId"], message: "Subject is required" });
    if (new Date(value.endsAt) <= new Date(value.startsAt))
      context.addIssue({ code: "custom", path: ["endsAt"], message: "End must follow start" });
    if (new Date(value.endsAt).getTime() - new Date(value.startsAt).getTime() > 31 * 86400000)
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Maximum duration is 31 days",
      });
    const taskType = value.type.includes("TASK_COUNT");
    if (taskType && value.targetValue > 100)
      context.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: "Task target is too high",
      });
    if (!taskType && value.targetValue < 10)
      context.addIssue({
        code: "custom",
        path: ["targetValue"],
        message: "Study target is at least 10 minutes",
      });
  });

export const leaderboardQuerySchema = z.object({
  metric: z.enum(["STUDY_MINUTES", "TASKS_COMPLETED"]).default("STUDY_MINUTES"),
  academicYear: z.coerce.number().int().min(1).max(6).optional(),
});

export const privacySchema = z
  .object({
    leaderboardVisible: z.boolean().optional(),
    shareFullNameOnCards: z.boolean().optional(),
    profileVisibility: z.enum(["PRIVATE", "COLLEGE_ONLY"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const shareSettingsSchema = z.object({ enabled: z.boolean().default(true) });
