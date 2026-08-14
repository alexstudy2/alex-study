import { z } from "zod";

export const collegeIdSchema = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9-]+$/);

export const registerSchema = z.object({
  name: z.string().trim().min(3).max(100),
  collegeId: collegeIdSchema,
  academicYear: z.coerce.number().int().min(1).max(6),
  email: z.union([z.literal(""), z.string().trim().email()]).optional(),
  password: z.string().min(8).max(128),
  locale: z.enum(["EN", "AR"]).default("EN"),
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
