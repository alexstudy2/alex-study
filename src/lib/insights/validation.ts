import { z } from "zod";

export const aiPreferenceSchema = z.object({ enabled: z.boolean() });
