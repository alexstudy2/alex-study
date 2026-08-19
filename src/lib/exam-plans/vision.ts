import "server-only";

import type OpenAI from "openai";
import type { AIUsage } from "@/lib/ai/jobs";
import { GROQ_VISION_MODEL, groq } from "@/lib/ai/groq";
import { parseVisionTopics } from "./topics";

/**
 * Reads a photographed syllabus index (فهرس) into topic rows.
 *
 * The instruction lives in the single user message rather than a system message on purpose: several
 * Groq vision models reject a system message, or `response_format`, when an image is attached. So
 * this asks for JSON politely and does not depend on getting it -- `parseVisionTopics` reads a plain
 * transcribed list just as well, which is the difference between a feature that works on whatever
 * model is served today and one that breaks when the catalogue changes.
 */
const READ_INDEX_PROMPT = [
  "This image is the table of contents, index or topic list of a study book or course.",
  "Transcribe every topic you can read, keeping the original language and wording.",
  'Reply with JSON only: {"topics":[{"title":"...","chapter":"..."}]}, where chapter is the heading the topic sits under, or null if it has none.',
  "Drop page numbers and numbering. Do not translate, summarise, reorder, explain or invent anything.",
  "Output the JSON object and nothing else: no explanation, no commentary, no thinking.",
  'If the image contains no topic list, reply {"topics":[]}.',
].join(" ");

/**
 * Off, please: the model's thinking, not the model's answer.
 *
 * Groq's `reasoning_format` defaults to `raw`, which puts the whole chain of thought in
 * `message.content` inside `<think>` tags -- and the default vision id is a reasoning model. A
 * photographed فهرس came back as a page of deliberation with the topic list quoted somewhere inside
 * it, and the thinking had eaten most of the token budget the transcription needed. `hidden` keeps it
 * out of the reply and `none` stops it being generated at all.
 *
 * Neither key belongs to the OpenAI request type and a model that does not know them answers 400 --
 * `GROQ_VISION_MODEL` may point at anything -- so a rejection is retried without them, and
 * `parseVisionTopics` still cuts a `<think>` block that arrives anyway.
 */
const REASONING_OFF = { reasoning_effort: "none", reasoning_format: "hidden" };

type VisionRequest = OpenAI.ChatCompletionCreateParamsNonStreaming;

function visionRequest(image: string, quiet: boolean) {
  return {
    model: GROQ_VISION_MODEL,
    temperature: 0,
    /* Room for eighty topics with their chapters, and for the thinking of a model that ignored the
       request above -- a budget that runs out mid-array is a syllabus that stops halfway. */
    max_completion_tokens: 4_000,
    ...(quiet ? REASONING_OFF : {}),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: READ_INDEX_PROMPT },
          // Straight from the request body to Groq: the image is never written to disk or to the
          // database. Only the transcribed topics are stored, under the existing 30-day retention.
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
  } as VisionRequest;
}

/** An id Groq no longer serves is the one failure worth naming: nothing else can fix it but `.env`. */
function isUnknownModel(reason: unknown) {
  const status = (reason as { status?: number } | null)?.status;
  const message = String((reason as { message?: string } | null)?.message ?? "");
  return status === 404 || /model/i.test(message);
}

export async function extractSyllabusTopics(
  input: { image: string; locale: "en" | "ar" },
  recordUsage: (usage?: AIUsage) => Promise<void>,
) {
  if (!groq) throw new Error("ai_unavailable");

  let completion;
  try {
    completion = await groq.chat.completions.create(visionRequest(input.image, true));
  } catch {
    /* The plain call is retried before anything is diagnosed, because a 400 for an unknown reasoning
       parameter reads exactly like a 400 about the model itself -- `isUnknownModel` would see the word
       and switch photo scanning off for good over a parameter this file could simply drop. If the
       second call fails too, the failure is the model's. */
    try {
      completion = await groq.chat.completions.create(visionRequest(input.image, false));
    } catch (reason) {
      throw new Error(isUnknownModel(reason) ? "vision_unavailable" : "ai_request_failed");
    }
  }

  await recordUsage(completion.usage);
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("empty_ai_response");
  return parseVisionTopics(content);
}
