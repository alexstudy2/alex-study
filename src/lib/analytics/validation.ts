import { z } from "zod";

export const analyticsQuerySchema = z.object({
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  subjectId: z.string().uuid().optional(),
});
