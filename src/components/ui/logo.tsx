"use client";

import React from "react";

/**
 * The brand lockup: a mark plus the wordmark.
 *
 * Both marks are always rendered and CSS picks one via `[data-skin]` on <html>, rather than
 * this taking a `skin` prop. Three reasons, in order of weight:
 *
 *  1. Switching skins in Settings only sets an attribute on <html> (see `applySkin`). A CSS
 *     choice therefore swaps the mark in the same frame, everywhere, with no listener and no
 *     re-render. A prop would need the skin threaded through the shell, the mobile sheet and
 *     the auth layout, and each of those would then need its own subscription to stay live.
 *  2. The auth layout has no session, so it has no skin to pass -- it would have to hardcode
 *     the default and would then be wrong for a signed-in user who chose doodle.
 *  3. The cost is about a dozen hidden SVG nodes at the one or two places the lockup appears.
 *     That is a different order of magnitude from the background doodle field, which is ~90
 *     painted nodes and so *is* conditionally rendered in study-background.tsx.
 *
 * The `.logo-mark-atlas` / `.logo-mark-doodle` display rules live in the Brand Mark section of
 * src/styles/components.css.
 */
export function AlexStudyLogo({ size = 34, className = "" }: { size?: number; className?: string }) {
  /* Both defs are referenced by `url(#id)`, so the ids have to be unique per instance -- the
     lockup renders twice when the mobile "more" sheet is open, and duplicate ids would make
     the second copy silently paint with the first one's gradient. Non-word characters are
     stripped because React's generated id contains delimiters that are not valid in a
     fragment reference. */
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tileGradient = `alex-logo-tile-${uid}`;
  const beamClip = `alex-logo-beam-${uid}`;

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}
    >
      {/* ---------- Atlas mark: the Pharos ----------
          Alexandria's lighthouse, reduced until the tower silhouette and the letter A are the
          same shape: two tapering legs, the light gallery as the crossbar, and the beacon
          itself as a gold apex. The diagonal beam of light doubles as the glass sheen, so the
          tile is part of the mark rather than a frame around it.

          Every colour is a palette token, so the mark re-tints with the mood instead of
          needing five variants. The glyph is --primary-foreground specifically: that token
          exists to be legible on --primary, which is what the tile is, so contrast holds on
          all five palettes without a single per-mood override (it is near-black on the light
          moods and white on aurora, where --primary is a mid green). */}
      <svg
        className="logo-mark-atlas shrink-0"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Stays inside the primary family on purpose. A gradient that ran all the way to
              --primary-strong would darken one end far past what --primary-foreground is
              contrast-matched against; lifting toward white instead keeps the tile readable
              and reads as light falling on glass.

              Written as inline `style` rather than the `stop-color` presentation attribute:
              presentation attributes are the weakest source in the cascade and browser support
              for `var()` inside them is uneven, whereas an inline declaration is unambiguous.
              This matters here because the value nests var() inside color-mix(). */}
          <linearGradient id={tileGradient} x1="0" y1="0" x2="1" y2="1">
            <stop
              offset="0%"
              style={{ stopColor: "color-mix(in srgb, #ffffff 18%, var(--primary))" }}
            />
            <stop offset="100%" style={{ stopColor: "var(--primary)" }} />
          </linearGradient>
          <clipPath id={beamClip}>
            <rect x="2" y="2" width="44" height="44" rx="12.5" />
          </clipPath>
        </defs>

        {/* The tile. The rim is the same hairline the Atlas skin puts on every surface, so the
            logo sits in the same material system as the cards next to it. */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12.5"
          fill={`url(#${tileGradient})`}
        />

        {/* The beam: a diagonal wedge of light thrown from the beacon across the tile, clipped
            to the tile's own rounded shape. This is the liquid-glass sheen and the
            lighthouse's light in one shape. */}
        <g clipPath={`url(#${beamClip})`}>
          <path
            d="M -6 20 L 30 -8 L 44 -8 L 6 30 Z"
            fill="#ffffff"
            opacity="0.16"
          />
        </g>

        {/* Tower legs / the letter A. Round caps keep the apex from reading as a cut-off spike
            at 24px, where a mitred join collapses into a blob. */}
        <path
          d="M14.5 36 L24 15"
          stroke="var(--primary-foreground)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        <path
          d="M33.5 36 L24 15"
          stroke="var(--primary-foreground)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
        {/* The light gallery -- the walkway below the lamp, and the A's crossbar. Its endpoints
            are computed to land exactly on the legs so the three strokes read as one glyph. */}
        <path
          d="M17.9 29.5 L30.1 29.5"
          stroke="var(--primary-foreground)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* The beacon. Gold, and the only warm note in the mark, so the eye lands on the light
            first. Sized to survive the 24px favicon: at that scale it is still ~3.5px across. */}
        <path
          d="M24 6.4 L27.7 12.2 L24 18 L20.3 12.2 Z"
          fill="var(--warning)"
        />

        {/* Rim last, so it draws over the beam and the glyph and reads as the tile's edge. */}
        <rect
          x="2"
          y="2"
          width="44"
          height="44"
          rx="12.5"
          fill="none"
          stroke="var(--glass-rim-strong)"
          strokeWidth="1.25"
        />
      </svg>

      {/* ---------- Doodle mark: unchanged ----------
          Byte-for-byte the original hand-drawn crest. The whole point of the skin split is
          that choosing doodle gets the app the user already had, so this is not "the old logo
          restyled" -- it is the old logo. */}
      <svg
        className="logo-mark-doodle shrink-0"
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Hand-Drawn Sketch Pad Shield */}
        <path
          d="M24 4C14 7 7 11 7 22C7 33.5 15.5 43.5 24 46C32.5 43.5 41 33.5 41 22C41 11 34 7 24 4Z"
          fill="var(--primary)"
          stroke="var(--secondary)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Playful Stethoscope / Caduceus Doodle */}
        <path
          d="M24 12V36"
          stroke="var(--secondary)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M17 18C17 18 22 15 25 19C28 23 20 27 25 31C28 34 23 36 23 36"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Sketch Spark Star */}
        <circle cx="24" cy="11" r="3.5" fill="var(--warning)" stroke="var(--secondary)" strokeWidth="1.5" />
      </svg>

      {/* One wordmark for both skins -- the brand should not change name when the materials
          do. Only the optical settings differ, and those are set on the class in components.css
          so this stays a single element.

          `opsz` is pinned rather than left to font-optical-sizing because Fraunces is loaded
          with the opsz axis (see layout.tsx) and its automatic value at this size is tuned for
          body copy, which leaves the lockup slightly soft. SOFT and WONK are held at 0 so the
          brand reads as a clean serif; the auth headlines are where those axes get used. */}
      <span className="logo-wordmark">
        Alex <span style={{ color: "var(--primary-strong)" }}>Study</span>
      </span>
    </span>
  );
}
