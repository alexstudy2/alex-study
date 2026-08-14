import { z } from "zod";

export const friendRequestSchema = z.object({ userId: z.string().uuid() });
export const accountabilityInviteSchema = z.object({ friendshipId: z.string().uuid() });
export const accountabilityPatchSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]),
});
export const notificationPreferencesSchema = z
  .object({
    emailNotifications: z.boolean().optional(),
    inAppNotifications: z.boolean().optional(),
    accountabilityNotifications: z.boolean().optional(),
    challengeNotifications: z.boolean().optional(),
    aiInsightNotifications: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const searchQuerySchema = z.string().trim().min(2).max(80);
