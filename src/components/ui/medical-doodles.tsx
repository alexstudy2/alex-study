/**
 * The shared medical-doodle vocabulary: one ECG trace and nine pieces of line art, used by the
 * focus timer, the task pinboard and both empty states.
 *
 * It exists because all three places had started drawing the same things. The ECG path lived
 * inside focus-workspace.tsx and the glyph set inside sessions/medical-art.tsx, so a fourth
 * caller had the choice of importing from a feature component or copying the geometry -- and a
 * copied waveform is one that drifts the first time someone tunes the original.
 *
 * Everything here paints with `currentColor` so the caller's token decides the ink, which is
 * what lets one set of shapes serve five moods without a per-mood override.
 */
import { createElement } from "react";
import {
  Dna,
  FlaskConical,
  HeartPulse,
  Microscope,
  Pill,
  Stethoscope,
  Syringe,
  TestTubes,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

/* One cardiac cycle on a baseline of 20 in a 40-unit-tall box: a flat segment, the small P
   bump, the QRS spike, then the broad T wave. Eight of them make a 480-unit strip that a
   stylesheet can scroll leftwards by exactly half its own width -- 240 units is four whole
   beats, so the window is identical at both ends of the loop and there is no seam to hide. The
   beat is a function rather than eight hand-written copies because the seam only holds while
   every beat is the same width. */
export function ecgBeat(x: number) {
  return (
    `L${x + 8} 20 Q${x + 13} 12 ${x + 18} 20 L${x + 23} 20 L${x + 26} 25 L${x + 30} 4` +
    ` L${x + 34} 31 L${x + 37} 20 L${x + 44} 20 Q${x + 50} 11 ${x + 56} 20 L${x + 60} 20`
  );
}

export const ECG_BEATS = 8;
export const ECG_PATH = `M0 20 ${Array.from({ length: ECG_BEATS }, (_, i) => ecgBeat(i * 60)).join(" ")}`;

/** The box `ECG_PATH` is drawn in. Callers that stretch the strip need `preserveAspectRatio="none"`. */
export const ECG_VIEWBOX = "0 0 480 40";

/**
 * A flatline that breaks into a single beat, for empty states.
 *
 * Deliberately not `ECG_PATH`: eight beats says "working", one beat after a long flat run says
 * "nothing here yet, and the next thing you do starts it". Same 40-unit box and baseline, so
 * both traces can share one stylesheet rule.
 */
export const ECG_FLATLINE_PATH = `M0 20 L120 20 ${ecgBeat(120)} L420 20 L480 20`;

/**
 * The trace, as a `<span>`-wrapped SVG. `aria-hidden` throughout -- it is texture, and every
 * caller states the same thing in words next to it.
 */
export function EcgTrace({
  className = "",
  variant = "pulse",
}: {
  className?: string;
  /** `pulse` = eight beats (active), `flatline` = one beat after a long flat run (empty). */
  variant?: "pulse" | "flatline";
}) {
  return (
    <span className={`ecg-trace ${className}`.trim()} aria-hidden="true">
      <svg viewBox={ECG_VIEWBOX} preserveAspectRatio="none">
        <path
          className="ecg-trace-line"
          d={variant === "flatline" ? ECG_FLATLINE_PATH : ECG_PATH}
        />
      </svg>
    </span>
  );
}

/**
 * The watermark set. Ordered, and the order is load-bearing: `glyphFor` indexes into it, so
 * inserting in the middle reshuffles which course draws which instrument. Append, don't splice.
 */
export const MEDICAL_GLYPHS: LucideIcon[] = [
  Stethoscope,
  HeartPulse,
  Dna,
  Microscope,
  FlaskConical,
  Pill,
  Syringe,
  TestTubes,
  Thermometer,
];

/**
 * Pick a glyph for a key -- a course id, usually.
 *
 * A hash rather than a counter so a course keeps the same instrument everywhere it appears:
 * across the board, the dashboard, a filtered view, and a reload in a different order. FNV-1a
 * because it is four lines and spreads short similar strings (cuid()s differ only in their
 * tail) far better than summing char codes, which would clump them.
 *
 * `>>> 0` after the multiply keeps it an unsigned 32-bit integer -- without it the intermediate
 * goes past 2^53, loses precision, and the "same key, same glyph" promise quietly breaks.
 */
export function glyphFor(key: string | null | undefined): LucideIcon {
  if (!key) return MEDICAL_GLYPHS[0];
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return MEDICAL_GLYPHS[hash % MEDICAL_GLYPHS.length];
}

/**
 * The chosen glyph, rendered. Prefer this over calling `glyphFor` at a call site.
 *
 * `createElement` rather than `const Icon = glyphFor(seed)` followed by `<Icon />`: the
 * react-hooks lint rule reads a capitalised local assigned from an opaque call as a component
 * *defined* during render -- the pattern that silently resets a subtree's state on every render --
 * and it cannot see that `glyphFor` only ever hands back one of nine module-level imports.
 * (`page-header.tsx` keeps its `const BackIcon = isRtl ? ArrowRight : ArrowLeft` because a
 * conditional between two imports *is* traceable to module scope; a function call is not.) These
 * icons hold no state, so the warning is a false positive here -- but satisfying the rule costs
 * one call, where a disable comment would also blind the file to a real violation later.
 */
export function MedicalGlyph({
  seed,
  className,
}: {
  /** Usually a course id, so a course draws the same instrument everywhere. */
  seed: string | null | undefined;
  className?: string;
}) {
  return createElement(glyphFor(seed), { className, "aria-hidden": true });
}
