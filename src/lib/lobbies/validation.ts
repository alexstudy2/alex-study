import { z } from "zod";
export const roomInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  chatEnabled: z.boolean().default(true),
  maxMembers: z.number().int().min(2).max(25).default(25),
});
export const messageSchema = z.object({ body: z.string().trim().min(1).max(500) });
export const roomTimerSchema = z.object({
  mode: z.enum(["FOCUS", "SHORT_BREAK", "LONG_BREAK"]),
  durationSeconds: z.number().int().min(60).max(14400),
});
export const lobbyTaskSchema = z.object({
  title: z.string().trim().max(180).nullable().optional(),
  completed: z.boolean().optional(),
});
export const reactionSchema = z.object({
  sessionId: z.string().uuid(),
  reaction: z.enum(["👏", "🔥", "💪", "✅"]),
});
