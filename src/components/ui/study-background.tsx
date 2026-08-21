"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MOOD_STORAGE_KEY, type StudyMood } from "@/lib/settings/study-mood";
import { SKIN_STORAGE_KEY, type StudySkin } from "@/lib/settings/study-skin";

export function StudyBackground({
  initialMood = "notebook",
  initialSkin = "atlas",
}: {
  initialMood?: StudyMood;
  initialSkin?: StudySkin;
}) {
  const [mood, setMood] = useState<StudyMood>(initialMood);
  const [skin, setSkin] = useState<StudySkin>(initialSkin);
  /* Shadow copies of the props, so a *change* in them can be told apart from a re-render that
     merely passes the same ones again. */
  const [serverMood, setServerMood] = useState<StudyMood>(initialMood);
  const [serverSkin, setServerSkin] = useState<StudySkin>(initialSkin);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef({ x: 50, y: 50 });
  const targetPosRef = useRef({ x: 50, y: 50 });
  const rafIdRef = useRef<number | null>(null);

  /* Follow the server when it moves. useState only reads its argument on the first render, so
     without this the props are a one-time seed: the pickers call router.refresh() after a
     successful write, layout.tsx re-renders with the saved preference, and this component keeps
     drawing whatever it was mounted with.

     Normally the synthetic StorageEvent from applyMood/applySkin has already updated the state
     and this is a no-op. The case it actually rescues is the one where that event never fires --
     localStorage throws in private mode, so applySkin sets `data-skin` on <html> and then bails
     before dispatching. The root attribute flips, the layer below does not, and Atlas ends up
     with the doodle field still in the tree. The refresh is then the only signal left.

     Set during render rather than in an effect: React re-runs this render immediately without
     committing the stale layer, so there is no frame of the wrong background. Deliberately not
     guarded on "is this a real change" beyond the comparison -- if the server and the client
     disagree, the server wrote it and the server wins. */
  if (initialMood !== serverMood) {
    setServerMood(initialMood);
    setMood(initialMood);
  }
  if (initialSkin !== serverSkin) {
    setServerSkin(initialSkin);
    setSkin(initialSkin);
  }

  /* Cross-tab and cross-component sync only. The starting mood and skin arrive from the
     server as props, so there is nothing to read on mount -- that mount read is what used to
     repaint the entire background one frame after hydration. */
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MOOD_STORAGE_KEY && e.newValue) {
        startTransition(() => setMood(e.newValue as StudyMood));
      }
      if (e.key === SKIN_STORAGE_KEY && e.newValue) {
        startTransition(() => setSkin(e.newValue as StudySkin));
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Sync dataset attributes on root element for contrast and material styling
  useEffect(() => {
    document.documentElement.dataset.mood = mood;
  }, [mood]);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  // Smooth mouse spotlight & subtle parallax with RAF
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    /* No pointer to follow on a touch device, so this loop would run every frame for a
       spotlight that never moves -- pure battery drain on the platform that can least
       afford it. */
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const handlePointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      targetPosRef.current = { x, y };
    };

    const updateLoop = () => {
      const current = mousePosRef.current;
      const target = targetPosRef.current;
      const dx = target.x - current.x;
      const dy = target.y - current.y;

      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        current.x += dx * 0.08;
        current.y += dy * 0.08;

        if (containerRef.current) {
          containerRef.current.style.setProperty("--mouse-x", `${current.x.toFixed(2)}%`);
          containerRef.current.style.setProperty("--mouse-y", `${current.y.toFixed(2)}%`);
        }
      }

      rafIdRef.current = requestAnimationFrame(updateLoop);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    rafIdRef.current = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  /* The two skins draw completely different backgrounds, so each one's layer is skipped
     rather than hidden: the doodle field is eight inline SVGs with ~90 painted nodes, and
     leaving that in the tree under `display: none` on every Atlas page load would cost the
     parse and the memory for nothing. components.css also hides whichever layer does not
     belong to the active skin -- that guard is for the static geometry-check fixture, which
     has no React to do the choosing and renders both. */
  const atlas = skin === "atlas";

  return (
    <div
      ref={containerRef}
      className={`study-ambient-canvas mood-${mood} skin-${skin}`}
      aria-hidden="true"
    >
      {/* 1. Flat Texture Layer (Graph Paper / Dotted Notebook) */}
      <div className="ambient-texture-grid" />

      {atlas ? (
        /* Atlas: an aurora mesh. Three blurred gradient orbs on long, offset drift loops --
           pure CSS, so it keeps running off the main thread while the app hydrates and
           fetches. The spotlight reads --mouse-x/y as a gradient POSITION on this element
           rather than as a transform on the orbs: driving a child's transform from a parent
           custom property restyles every child on every frame. */
        <div className="ambient-aurora-layer">
          <div className="ambient-aurora-orb ambient-aurora-orb-1" />
          <div className="ambient-aurora-orb ambient-aurora-orb-2" />
          <div className="ambient-aurora-orb ambient-aurora-orb-3" />
          <div className="ambient-aurora-spotlight" />
          <div className="ambient-aurora-veil" />
        </div>
      ) : (
        /* 3. Rich Colorful Curva Study Drawings Layer */
        <div className="ambient-doodles-layer">
          {/* Drawing 1: Stack of Colorful Study Books with Ribbon (Top-Left) */}
          <svg
            className="study-curva-drawing doodle-pos-1"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Bottom Book */}
            <path
              d="M 12 70 C 25 67, 75 67, 88 70 C 88 78, 88 80, 88 84 C 75 81, 25 81, 12 84 Z"
              fill="var(--curva-book-1, #38BDF8)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Middle Book */}
            <path
              d="M 16 54 C 28 51, 72 51, 84 54 C 84 62, 84 64, 84 68 C 72 65, 28 65, 16 68 Z"
              fill="var(--curva-book-2, #F472B6)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Top Book */}
            <path
              d="M 22 38 C 32 35, 68 35, 78 38 C 78 46, 78 48, 78 52 C 68 49, 32 49, 22 52 Z"
              fill="var(--curva-book-3, #FBBF24)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Bookmark Ribbon */}
            <path
              d="M 46 38 C 47 48, 48 55, 52 64 L 46 60 L 40 64 C 42 55, 43 48, 44 38 Z"
              fill="#EF4444"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="1.8"
            />
            {/* Decorative Sparkle */}
            <path
              d="M 85 28 L 87 34 L 93 36 L 87 38 L 85 44 L 83 38 L 77 36 L 83 34 Z"
              fill="#FBBF24"
            />
          </svg>

          {/* Drawing 2: Steaming Coffee Mug with Curvy Steam (Top-Right) */}
          <svg
            className="study-curva-drawing doodle-pos-2"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Mug Body */}
            <path
              d="M 28 42 C 28 72, 34 82, 56 82 C 78 82, 84 72, 84 42 Z"
              fill="var(--curva-mug, #818CF8)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Mug Inner Liquid */}
            <ellipse
              cx="56"
              cy="42"
              rx="28"
              ry="9"
              fill="#78350F"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
            />
            {/* Mug Handle */}
            <path
              d="M 84 48 C 96 48, 98 70, 80 72"
              fill="none"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Curvy Steam 1 */}
            <path
              d="M 44 30 C 40 22, 50 16, 46 8"
              fill="none"
              stroke="var(--curva-accent, #F59E0B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="1 1"
            />
            {/* Curvy Steam 2 */}
            <path
              d="M 58 32 C 54 20, 66 14, 60 6"
              fill="none"
              stroke="var(--curva-accent, #F59E0B)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Curvy Steam 3 */}
            <path
              d="M 70 30 C 66 22, 74 16, 70 8"
              fill="none"
              stroke="var(--curva-accent, #F59E0B)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Drawing 3: Colorful Curved Pencil & Highlighter (Mid-Left) */}
          <svg
            className="study-curva-drawing doodle-pos-3"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Pencil Body (Diagonal) */}
            <g transform="rotate(-35 50 50)">
              {/* Wooden Tip */}
              <path
                d="M 50 15 L 42 32 L 58 32 Z"
                fill="#FDE68A"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.5"
              />
              {/* Graphite Tip */}
              <path d="M 50 15 L 46 23 L 54 23 Z" fill="var(--curva-stroke, #263D5B)" />
              {/* Pencil Shaft */}
              <rect
                x="42"
                y="32"
                width="16"
                height="45"
                fill="var(--curva-pencil, #34D399)"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.5"
              />
              {/* Metal Band */}
              <rect
                x="42"
                y="77"
                width="16"
                height="8"
                fill="#CBD5E1"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.5"
              />
              {/* Eraser */}
              <path
                d="M 42 85 C 42 92, 58 92, 58 85 Z"
                fill="#F472B6"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.5"
              />
            </g>
            {/* Curvy Scribble Line under pencil */}
            <path
              d="M 18 78 C 30 70, 40 85, 55 75 C 68 65, 80 82, 92 72"
              fill="none"
              stroke="var(--curva-pencil, #34D399)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Drawing 4: Medical / Science Curvy Flask with Bubbles (Bottom-Right) */}
          <svg
            className="study-curva-drawing doodle-pos-4"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Flask Body */}
            <path
              d="M 44 18 L 44 38 L 22 76 C 18 83, 24 90, 32 90 L 68 90 C 76 90, 82 83, 78 76 L 56 38 L 56 18 Z"
              fill="var(--curva-flask-bg, rgba(255,255,255,0.7))"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Flask Neck Rim */}
            <rect
              x="40"
              y="14"
              width="20"
              height="5"
              rx="2.5"
              fill="#E2E8F0"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            {/* Flask Liquid */}
            <path
              d="M 27 68 C 38 64, 62 72, 73 68 L 78 76 C 82 83, 76 90, 68 90 L 32 90 C 24 90, 18 83, 22 76 Z"
              fill="var(--curva-liquid, #06B6D4)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            {/* Bubbles */}
            <circle cx="48" cy="76" r="4" fill="#FFFFFF" opacity="0.8" />
            <circle cx="58" cy="62" r="3" fill="#FFFFFF" opacity="0.8" />
            <circle cx="42" cy="52" r="2.5" fill="var(--curva-liquid, #06B6D4)" />
            <circle cx="54" cy="38" r="3" fill="var(--curva-liquid, #06B6D4)" />
          </svg>

          {/* Drawing 5: Curvy Idea Lightbulb with Rays (Mid-Bottom-Left) */}
          <svg
            className="study-curva-drawing doodle-pos-5"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Bulb Glow Behind */}
            <circle
              cx="50"
              cy="42"
              r="28"
              fill="var(--curva-bulb-glow, rgba(251, 191, 36, 0.25))"
            />
            {/* Glass Body */}
            <path
              d="M 32 42 C 32 28, 68 28, 68 42 C 68 52, 60 58, 58 66 L 42 66 C 40 58, 32 52, 32 42 Z"
              fill="var(--curva-bulb, #FDE047)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Filament */}
            <path
              d="M 44 50 L 48 38 L 52 38 L 56 50"
              fill="none"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Screw Base */}
            <rect
              x="42"
              y="68"
              width="16"
              height="5"
              rx="1"
              fill="#94A3B8"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            <rect
              x="44"
              y="74"
              width="12"
              height="4"
              rx="1"
              fill="#94A3B8"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            {/* Rays */}
            <path d="M 50 12 L 50 6" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 22 24 L 16 20" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 78 24 L 84 20" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 18 46 L 10 46" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 82 46 L 90 46" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
          </svg>

          {/* Drawing 6: Curled Sticky Note with Pin & Scribbles (Top-Center) */}
          <svg
            className="study-curva-drawing doodle-pos-6"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Note Body with Curled Bottom Corner */}
            <path
              d="M 20 22 L 80 22 L 80 62 L 62 80 L 20 80 Z"
              fill="var(--curva-note, #FEF08A)"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Curled Fold */}
            <path
              d="M 62 80 L 62 62 L 80 62 Z"
              fill="#FDE047"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Sketch Lines inside note */}
            <path
              d="M 30 38 L 70 38"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 3"
            />
            <path
              d="M 30 48 L 65 48"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 3"
            />
            <path
              d="M 30 58 L 52 58"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="6 3"
            />
            {/* Push Pin */}
            <circle
              cx="50"
              cy="18"
              r="6"
              fill="#EF4444"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
          </svg>

          {/* Drawing 7: Curvy Medical DNA Helix / Caduceus (Bottom-Center) */}
          <svg
            className="study-curva-drawing doodle-pos-7"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* DNA Strand 1 (Curva wave) */}
            <path
              d="M 32 15 C 68 28, 68 45, 32 58 C 68 70, 68 88, 32 95"
              fill="none"
              stroke="var(--curva-dna-1, #EC4899)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* DNA Strand 2 (Inverted Curva wave) */}
            <path
              d="M 68 15 C 32 28, 32 45, 68 58 C 32 70, 32 88, 68 95"
              fill="none"
              stroke="var(--curva-dna-2, #3B82F6)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Connecting Rungs with colorful nodes */}
            <line
              x1="38"
              y1="22"
              x2="62"
              y2="22"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            <circle cx="38" cy="22" r="3.5" fill="#FBBF24" />
            <circle cx="62" cy="22" r="3.5" fill="#34D399" />

            <line
              x1="42"
              y1="40"
              x2="58"
              y2="40"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            <circle cx="42" cy="40" r="3.5" fill="#EC4899" />
            <circle cx="58" cy="40" r="3.5" fill="#3B82F6" />

            <line
              x1="38"
              y1="52"
              x2="62"
              y2="52"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            <circle cx="38" cy="52" r="3.5" fill="#38BDF8" />
            <circle cx="62" cy="52" r="3.5" fill="#A855F7" />

            <line
              x1="42"
              y1="72"
              x2="58"
              y2="72"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
            />
            <circle cx="42" cy="72" r="3.5" fill="#F43F5E" />
            <circle cx="58" cy="72" r="3.5" fill="#10B981" />
          </svg>

          {/* Drawing 8: Origami Paper Airplane with Loop Trail (Mid-Right) */}
          <svg
            className="study-curva-drawing doodle-pos-8"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Dotted Curva Loop Trail */}
            <path
              d="M 12 75 C 28 85, 45 78, 38 60 C 32 46, 18 52, 28 38 C 38 24, 60 40, 72 32"
              fill="none"
              stroke="var(--curva-stroke, #263D5B)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="4 4"
            />
            {/* Paper Plane Group */}
            <g transform="translate(48, 12) rotate(15)">
              {/* Top Wing */}
              <path
                d="M 10 30 L 45 10 L 32 40 Z"
                fill="var(--curva-plane, #60A5FA)"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Bottom Wing */}
              <path
                d="M 32 40 L 45 10 L 15 48 Z"
                fill="var(--curva-plane-dark, #3B82F6)"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Keel */}
              <path
                d="M 10 30 L 22 36 L 32 40 Z"
                fill="#93C5FD"
                stroke="var(--curva-stroke, #263D5B)"
                strokeWidth="1.8"
              />
            </g>
          </svg>
        </div>
      )}
    </div>
  );
}
