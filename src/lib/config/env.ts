import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  GROQ_API_KEY: z.string().optional(),
  /**
   * Overrides the multimodal model used to read a photographed syllabus. Optional and swappable
   * from `.env` on purpose: vision model ids on Groq come and go faster than releases here, and an
   * id that stops being served should cost one line in an env file, not a code change.
   */
  GROQ_VISION_MODEL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost:5432/alex_study",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "development-only-change-this-secret-123456",
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_VISION_MODEL: process.env.GROQ_VISION_MODEL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
