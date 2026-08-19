/**
 * Topic intake for the AI Exam Plan: the vocabulary, the canonical rendering, the OCR fallback and
 * the shape check on what the model sends back.
 *
 * Deliberately zod-free and Prisma-free. The topic composer and the scanner are client components
 * and use `MAX_TOPICS`, `renderSyllabusText` and the label maps directly; the zod schemas live in
 * ./validation.ts, which is server-side. Keeping the two apart is what stops the whole validation
 * layer from being pulled into the browser bundle for the sake of a constant.
 */

export const MAX_TOPICS = 80;

/**
 * The upload cap for a photographed فهرس, shared so the scanner shrinks the picture until it fits
 * rather than posting 9 MB from a modern phone camera and reading the rejection back as a 400.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const TOPIC_WEIGHTS = ["LIGHT", "NORMAL", "HEAVY"] as const;
export const TOPIC_CONFIDENCES = ["WEAK", "OK", "STRONG"] as const;
export const QUESTION_STRATEGIES = ["DEDICATED_DAYS", "INTEGRATED"] as const;
export const EXAM_ITEM_KINDS = ["STUDY", "QUESTIONS", "REVIEW"] as const;

export type TopicWeight = (typeof TOPIC_WEIGHTS)[number];
export type TopicConfidence = (typeof TOPIC_CONFIDENCES)[number];
export type QuestionStrategy = (typeof QUESTION_STRATEGIES)[number];
export type ExamItemKind = (typeof EXAM_ITEM_KINDS)[number];

/**
 * One line of the syllabus as the student describes it.
 *
 * `weight` and `confidence` are the reason this is a row and not a line of text: how big a topic is
 * and how shaky the student feels about it are exactly what a study plan should be built around,
 * and neither can be guessed from the title.
 */
export type ExamTopic = {
  title: string;
  chapter: string | null;
  weight: TopicWeight;
  confidence: TopicConfidence;
};

/** Defaults for a fresh row, and for anything the OCR could not tell us. */
export const DEFAULT_TOPIC: Omit<ExamTopic, "title"> = {
  chapter: null,
  weight: "NORMAL",
  confidence: "OK",
};

const WEIGHT_WORD: Record<TopicWeight, string> = {
  LIGHT: "light",
  NORMAL: "normal",
  HEAVY: "heavy",
};

const CONFIDENCE_WORD: Record<TopicConfidence, string> = {
  WEAK: "weak",
  OK: "steady",
  STRONG: "strong",
};

function annotation(topic: ExamTopic) {
  const parts = [
    topic.weight === "NORMAL" ? null : WEIGHT_WORD[topic.weight],
    topic.confidence === "OK" ? null : CONFIDENCE_WORD[topic.confidence],
  ].filter(Boolean);
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

/**
 * Topic rows -> the one string that gets stored, hashed and prompted with.
 *
 * `ExamPlan.syllabusText` stays the single piece of retained context, so the 30-day purge, the
 * `inputHash` and the 15-minute re-use cache all keep working unchanged. That makes this function
 * load-bearing in an invisible way: the same rows must always render byte-identically, or two
 * presses of Generate stop looking like the same request and the cache silently stops holding.
 *
 * Grouped by chapter in first-appearance order, with unlabelled topics kept in place rather than
 * shuffled to the end -- a `Map` preserves insertion order, which is the only ordering guarantee
 * this needs.
 */
export function renderSyllabusText(topics: ExamTopic[]) {
  const groups = new Map<string, ExamTopic[]>();
  for (const topic of topics) {
    const key = topic.chapter ?? "";
    const existing = groups.get(key);
    if (existing) existing.push(topic);
    else groups.set(key, [topic]);
  }
  const lines: string[] = [];
  for (const [chapter, list] of groups) {
    if (chapter) lines.push(`## ${chapter}`);
    for (const topic of list) lines.push(`- ${topic.title}${annotation(topic)}`);
  }
  return lines.join("\n");
}

/** Arabic-Indic and Persian digits -> ASCII, so page numbers on a فهرس are recognisable below. */
function asciiDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * A table of contents lists a page number after every entry, usually behind dotted leaders. The
 * separator run must be at least two characters ("Heart failure ..... 42", "Heart failure   42") so
 * that a topic which simply ends in a number ("Cranial nerve 7") keeps it.
 */
const PAGE_TAIL = /[\s.·…_\-]{2,}\d{1,4}$/;
const LEADING_BULLET = /^[\s]*(?:[-*•·–—]+|\(?\d{1,3}[.)]|[٠-٩۰-۹]{1,3}[.)])\s*/;
/**
 * The boundary is `(?![\p{L}])` and not `\b` on purpose: `\b` is defined against ASCII `\w`, so it
 * never fires between an Arabic letter and the following space -- `/^الباب\b/` cannot match "الباب
 * الأول" at all, which would silently turn every heading on an Arabic فهرس into a topic.
 */
const HEADING_WORD =
  /^(chapter|unit|section|part|block|module|lecture|paper|الباب|باب|الفصل|فصل|الوحدة|وحدة|القسم|قسم|محاضرة)(?![\p{L}])/iu;

function cleanLine(raw: string) {
  const withoutBullet = asciiDigits(raw).replace(LEADING_BULLET, "");
  return withoutBullet.replace(PAGE_TAIL, "").replace(/\s+/g, " ").trim();
}

function isHeading(line: string) {
  return HEADING_WORD.test(line) || /[:：]$/.test(line);
}

function topicRow(title: string, chapter: string | null): ExamTopic {
  return { ...DEFAULT_TOPIC, chapter, title: title.slice(0, 160) };
}

/** A topic has letters in it. `"..."`, `42` and `---` are punctuation the model left behind. */
function isTopicTitle(value: string) {
  return value.length >= 3 && /[\p{L}]/u.test(value);
}

function stripFences(raw: string) {
  return raw.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
}

/**
 * The chain of thought a reasoning model writes before its answer.
 *
 * Groq's `reasoning_format` defaults to `raw`, which leaves the thinking in `message.content` inside
 * `<think>` tags -- and the default vision id is a reasoning model. The vision call now asks for the
 * thinking to be dropped, but until it did, every sentence of it arrived in the composer as a topic:
 * "The user wants me to transcribe the table of contents", "1. Analyze the image", and a heading like
 * "Final JSON structure:" became a chapter. So the thinking is cut before anything is read, whatever
 * the request asked for.
 */
const REASONING_TAGS = "think|thinking|reasoning|analysis";
const REASONING_BLOCK = new RegExp(`<(${REASONING_TAGS})>[\\s\\S]*?</\\1>`, "gi");
const REASONING_HEAD = new RegExp(`^[\\s\\S]*</(?:${REASONING_TAGS})>`, "i");
const REASONING_TAIL = new RegExp(`<(?:${REASONING_TAGS})>[\\s\\S]*$`, "i");

function withoutReasoning(raw: string) {
  /* Paired blocks first, so what the other two patterns see is genuinely unpaired: a tag that never
     closed is the reply that ran out of tokens mid-thought, and a stray closing tag the one whose
     opening tag never arrived. Neither side of an unpaired tag is an answer. */
  return raw
    .replace(REASONING_BLOCK, "\n")
    .replace(REASONING_HEAD, "\n")
    .replace(REASONING_TAIL, "\n")
    .trim();
}

/**
 * Every balanced `{...}` in the reply, in the order they open.
 *
 * `indexOf("{")` to `lastIndexOf("}")` was not enough. A model that quotes the shape it was asked for
 * -- 'the user requested `{"topics":[{"title":"...","chapter":"..."}]}`' -- makes that span start in
 * the quote and end in the real answer, so `JSON.parse` rejects the lot and a perfectly good reply
 * used to fall through to the line reader. Strings are tracked because a brace inside a title is not
 * structure.
 */
function jsonObjects(raw: string) {
  const found: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === "}" && depth > 0) {
      depth -= 1;
      if (!depth) found.push(raw.slice(start, index + 1));
    }
  }
  return found;
}

/** Rows from one parsed object, or null when `topics` is not an array and this is some other object. */
function rowsFromObject(parsed: unknown): ExamTopic[] | null {
  const list = (parsed as { topics?: unknown })?.topics;
  if (!Array.isArray(list)) return null;
  const rows: ExamTopic[] = [];
  for (const entry of list) {
    if (typeof entry === "string") {
      const title = cleanLine(entry);
      if (isTopicTitle(title)) rows.push(topicRow(title, null));
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const title = cleanLine(typeof record.title === "string" ? record.title : "");
    if (!isTopicTitle(title)) continue;
    const chapterRaw = typeof record.chapter === "string" ? cleanLine(record.chapter) : "";
    rows.push(topicRow(title, chapterRaw ? chapterRaw.slice(0, 80) : null));
  }
  return rows;
}

/**
 * The `{"topics":[...]}` object in the reply -- the fullest one, not the first, because a quoted
 * template comes before the answer it is a template for.
 *
 * An empty array is a real answer ("this photo has no topic list") and is kept distinct from null
 * ("there is no such object here"): reading `{"topics":[]}` as text would file the reply itself as a
 * topic.
 */
function fromJson(raw: string): ExamTopic[] | null {
  let best: ExamTopic[] | null = null;
  for (const candidate of jsonObjects(raw)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const rows = rowsFromObject(parsed);
    if (rows && (!best || rows.length > best.length)) best = rows;
  }
  return best;
}

/**
 * The `"title": "...", "chapter": "..."` pairs of a reply whose array never closed, because
 * `max_completion_tokens` ran out partway down a long index. The entries before the cut are real, and
 * the alternative is the student typing them again.
 */
const TOPIC_FRAGMENT =
  /"title"\s*:\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"chapter"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|null))?/g;

function unescapeJson(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function fromFragments(raw: string): ExamTopic[] | null {
  const rows: ExamTopic[] = [];
  for (const match of raw.matchAll(TOPIC_FRAGMENT)) {
    const title = cleanLine(unescapeJson(match[1] ?? ""));
    if (!isTopicTitle(title)) continue;
    const chapter = cleanLine(unescapeJson(match[2] ?? ""));
    rows.push(topicRow(title, chapter ? chapter.slice(0, 80) : null));
  }
  return rows.length ? rows : null;
}

/** JSON if there is any, then a cut-off array, then the reply read the way a person would read it. */
function readReply(answer: string): { rows: ExamTopic[]; warning: "truncated" | "read_as_text" | null } {
  const structured = fromJson(answer);
  if (structured) return { rows: structured, warning: null };
  const fragments = fromFragments(answer);
  if (fragments) return { rows: fragments, warning: "truncated" };
  return { rows: readAsLines(answer), warning: "read_as_text" };
}

/**
 * The photographed فهرس as topic rows.
 *
 * Written to survive a model that ignores the JSON instruction, which is why the vision call does
 * not ask for JSON mode at all: several Groq vision models refuse `response_format` alongside an
 * image, and a plain transcribed list is a perfectly good answer. So: cut the model's thinking, try
 * JSON, salvage a cut-off array, and otherwise read the reply the way a person would -- headings
 * become chapters, everything under them becomes a topic, page numbers and bullets are dropped.
 *
 * Nothing here is trusted as final. The rows land in the composer for the student to edit, because
 * OCR of a phone photo of a printed index is a draft by nature.
 */
export function parseVisionTopics(raw: string): { topics: ExamTopic[]; warning: string | null } {
  const answer = withoutReasoning(stripFences(raw ?? ""));
  if (!answer) return { topics: [], warning: "nothing_read" };

  const { rows, warning } = readReply(answer);
  const seen = new Set<string>();
  const unique: ExamTopic[] = [];
  for (const row of rows) {
    // A multi-page index repeats its running header; a duplicated topic would double its study time.
    const key = row.title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  if (!unique.length) return { topics: [], warning: "nothing_read" };
  const capped = unique.slice(0, MAX_TOPICS);
  return { topics: capped, warning: capped.length < unique.length ? "truncated" : warning };
}

function readAsLines(cleaned: string): ExamTopic[] {
  const rows: ExamTopic[] = [];
  let chapter: string | null = null;
  for (const rawLine of cleaned.split(/\r?\n/)) {
    const line = cleanLine(rawLine);
    if (!isTopicTitle(line)) continue;
    if (isHeading(line)) {
      chapter = line.replace(/[:：]$/, "").trim().slice(0, 80);
      continue;
    }
    rows.push(topicRow(line, chapter));
  }
  return rows;
}

/**
 * Did the model actually honour the brief?
 *
 * Three checks only, each one weak enough that any reasonable proposal passes and strong enough to
 * catch a model that ignored the instruction outright. A failure is thrown as `invalid_ai_plan`,
 * which is retryable, so the usual outcome of a bad first draft is a good second one.
 *
 * The daily ceiling gets an hour of grace: refusing a plan because one day runs eleven minutes over
 * would throw away an otherwise fine proposal, and the student can still edit any day down.
 */
export function proposalShapeError(
  items: Array<{ plannedDate: string; estimatedMinutes: number; kind: ExamItemKind }>,
  strategy: QuestionStrategy,
  dailyCapacityMinutes: number,
): "daily_load_too_high" | "missing_question_day" | "missing_question_items" | null {
  const byDay = new Map<string, { minutes: number; kinds: Set<ExamItemKind> }>();
  for (const item of items) {
    const day = byDay.get(item.plannedDate) ?? { minutes: 0, kinds: new Set<ExamItemKind>() };
    day.minutes += item.estimatedMinutes;
    day.kinds.add(item.kind);
    byDay.set(item.plannedDate, day);
  }
  const ceiling = dailyCapacityMinutes + 60;
  for (const day of byDay.values()) if (day.minutes > ceiling) return "daily_load_too_high";

  if (strategy === "DEDICATED_DAYS") {
    const hasQuestionOnlyDay = [...byDay.values()].some(
      (day) => day.kinds.size === 1 && day.kinds.has("QUESTIONS"),
    );
    return hasQuestionOnlyDay ? null : "missing_question_day";
  }
  return items.some((item) => item.kind === "QUESTIONS") ? null : "missing_question_items";
}

/** Minutes as the board writes them: "45m", "3h", "3h 15m". */
export function formatLoad(minutes: number, ar = false) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return ar ? `${rest} د` : `${rest}m`;
  if (!rest) return ar ? `${hours} س` : `${hours}h`;
  return ar ? `${hours} س ${rest} د` : `${hours}h ${rest}m`;
}
