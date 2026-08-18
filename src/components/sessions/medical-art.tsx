/**
 * The two big illustrated panels that flank the timer in fullscreen focus mode.
 *
 * They are composed from icon line art wherever the icon set has the shape, because the ink has
 * to survive being blown up to fourteen rems: `vector-effect: non-scaling-stroke` in the
 * stylesheet pins every stroke to an absolute pixel width, so one set of shapes reads
 * correctly at 3rem and at 14rem without a second copy drawn at a different stroke weight.
 *
 * Everything is painted with `currentColor` from a token, so all five moods get a matching
 * palette for nothing: `--secondary` is dark ink on the four light moods and light ink on
 * cosmic, which is precisely the inversion that hand-picked hex colours would have needed a
 * per-mood override for. The drift classes carry both the float timing and a small rotation,
 * one pair per item, so no two pieces bob in step -- synchronised floating reads as a
 * carousel rather than as drawings pinned to a wall.
 *
 * Both panels are `aria-hidden`: they carry nothing the timer itself does not already say.
 */
import {
  Atom,
  Dna,
  FlaskConical,
  Heart,
  HeartPulse,
  Microscope,
  Pill,
  Stethoscope,
  Syringe,
  TestTubes,
  Thermometer,
} from "lucide-react";

/**
 * Lungs, on lucide's 24-unit grid so the watermark styling is the same rule for both panels.
 * Hand-drawn because the icon set has a heart and no lungs: a trachea down the middle, two
 * bronchi branching off it, and a lobe hanging from each with a straight inner wall and a
 * flared outer one. The lobes are closed and take the stylesheet's fill -- at a tenth of an
 * opacity a hairline outline vanishes and a silhouette does not. The three tubes carry
 * `fill="none"` so they stay lines: a presentation attribute on the child beats the fill
 * inherited from the svg, which is the only reason one rule can dress both shapes.
 */
function Lungs(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={props.className} aria-hidden="true">
      <path d="M12 3V10" fill="none" />
      <path d="M12 10C12 12 10.5 12.5 9.5 13" fill="none" />
      <path d="M12 10C12 12 13.5 12.5 14.5 13" fill="none" />
      <path d="M9.5 13C7 14 5 16.5 5 19C5 20.4 6 21 7.2 21C9 21 10.5 19.6 10.5 17.6V13.6C10.5 13.2 10 13 9.5 13Z" />
      <path d="M14.5 13C17 14 19 16.5 19 19C19 20.4 18 21 16.8 21C15 21 13.5 19.6 13.5 17.6V13.6C13.5 13.2 14 13 14.5 13Z" />
    </svg>
  );
}

/** Left of the dial: the examination side -- stethoscope, heart, and what is on the trolley. */
export function MedicalArtClinic() {
  return (
    <div className="focus-art-panel focus-art-clinic" aria-hidden="true">
      <Heart className="focus-art-watermark" />
      <div className="focus-art-row">
        <span className="focus-art-item art-md art-tone-danger art-drift-a">
          <HeartPulse />
        </span>
        <span className="focus-art-item art-sm art-tone-primary art-drift-b">
          <Pill />
        </span>
      </div>
      <span className="focus-art-item art-xl art-tone-ink art-drift-c">
        <Stethoscope />
      </span>
      <div className="focus-art-row">
        <span className="focus-art-item art-sm art-tone-muted art-drift-d">
          <Thermometer />
        </span>
        <span className="focus-art-item art-md art-tone-primary art-drift-e">
          <Syringe />
        </span>
      </div>
    </div>
  );
}

/** Right of the dial: the laboratory side -- helix, glassware, and the bench. */
export function MedicalArtLab() {
  return (
    <div className="focus-art-panel focus-art-lab" aria-hidden="true">
      <Lungs className="focus-art-watermark" />
      <div className="focus-art-row">
        <span className="focus-art-item art-md art-tone-success art-drift-e">
          <Atom />
        </span>
        <span className="focus-art-item art-sm art-tone-primary art-drift-d">
          <TestTubes />
        </span>
      </div>
      <span className="focus-art-item art-xl art-tone-ink art-drift-c">
        <Dna />
      </span>
      <div className="focus-art-row">
        <span className="focus-art-item art-sm art-tone-muted art-drift-b">
          <Microscope />
        </span>
        <span className="focus-art-item art-md art-tone-primary art-drift-a">
          <FlaskConical />
        </span>
      </div>
    </div>
  );
}
