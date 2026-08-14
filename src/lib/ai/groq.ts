import OpenAI from "openai";
import { env } from "@/lib/config/env";

export const GROQ_MODEL = "openai/gpt-oss-120b";
export const groq = env.GROQ_API_KEY
  ? new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: "https://api.groq.com/openai/v1" })
  : null;
