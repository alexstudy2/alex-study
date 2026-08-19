import OpenAI from "openai";
import { env } from "@/lib/config/env";

export const GROQ_MODEL = "openai/gpt-oss-120b";
/** Reads a photographed فهرس. Override with `GROQ_VISION_MODEL` if Groq stops serving this id. */
export const GROQ_VISION_MODEL = env.GROQ_VISION_MODEL ?? "qwen/qwen3.6-27b";
export const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;
