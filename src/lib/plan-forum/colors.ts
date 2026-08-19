/**
 * Subject labels -> the seven course colours.
 *
 * A plan note's subject is free text, so unlike a `Subject` row it carries no `colorToken` of its
 * own. Rather than paint every typed note the same grey, hash the label: "Anatomy" is the same
 * teal on the author's board, in a classmate's copy and in the calendar overlay, with nothing
 * stored and nothing to keep in sync.
 *
 * Pure and dependency-free so both the server routes and the unit tests can use it.
 */

/**
 * The closed list from `subjectInputSchema.colorToken` in src/lib/tasks/validation.ts, mirrored
 * by the `--subject-*` tokens in src/styles/tokens.css. Order is load-bearing -- `planColorToken`
 * indexes into it, so reordering repaints every existing note. Append only.
 */
export const PLAN_COLOR_TOKENS = ["teal", "coral", "amber", "violet", "sky", "rose", "slate"] as const;

export type PlanColorToken = (typeof PLAN_COLOR_TOKENS)[number];

/**
 * The same normalisation the subjects route writes into `Subject.normalizedName`
 * (src/app/api/subjects/route.ts) -- lowercased, runs of whitespace collapsed to one space.
 *
 * Shared deliberately: it is what lets "  anatomy " typed on a note match the "Anatomy" course
 * the student already owns, and it must not drift from what is in the database column.
 */
export function normalizeLabel(label: string) {
  return label.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

/**
 * A stable colour for a subject label.
 *
 * FNV-1a, the same hash `glyphFor` uses in src/components/ui/medical-doodles.tsx, and for the
 * same reason: it has to be deterministic across processes and devices, so `Math.random()` and
 * anything derived from insertion order are both out. `Math.imul` keeps the multiply in 32 bits
 * and `>>> 0` keeps it unsigned -- without that the value goes negative and `% length` returns a
 * negative index.
 */
export function planColorToken(label: string): PlanColorToken {
  const key = normalizeLabel(label);
  if (!key) return PLAN_COLOR_TOKENS[0];
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return PLAN_COLOR_TOKENS[hash % PLAN_COLOR_TOKENS.length];
}

/** Narrow a stored `colorToken` back to the closed set, since the column is a bare `String`. */
export function safeColorToken(token: string | null | undefined): PlanColorToken {
  const lower = (token ?? "").toLowerCase();
  return (PLAN_COLOR_TOKENS as readonly string[]).includes(lower)
    ? (lower as PlanColorToken)
    : PLAN_COLOR_TOKENS[0];
}
