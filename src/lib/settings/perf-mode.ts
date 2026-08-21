/**
 * The performance tier, shared by the layout's pre-paint script and the browser.
 *
 * Atlas layers dozens of backdrop-filter sheets over an animated aurora -- the most
 * expensive combination CSS offers, and one weak or thermally-throttled GPUs cannot hold
 * at frame rate. Rather than degrading the design for everyone, the device is sorted into
 * "full" (the intended material system) or "lite" (same palette and geometry; opaque
 * fills, static background -- see tokens.css and the lite block in components.css).
 *
 * Two independent triggers set it:
 *   1. Static signals at first paint (layout.tsx inline script): device memory, save-data,
 *      and core count on touch-class hardware. Runs before anything paints, so a weak
 *      device never pays for the heavy path even once.
 *   2. A runtime frame-rate watchdog (study-background.tsx): measured reality beats any
 *      spec sheet, so a machine that stumbles gets demoted no matter what its signals said.
 *
 * The two implementations of the static check must stay behaviourally identical: this
 * module for everything after hydration, and the hand-inlined string in layout.tsx for the
 * pre-paint window where no bundled code has run yet. If you change one, change both.
 *
 * Like study-mood.ts, this deliberately lives outside any `"use client"` module so server
 * code could read it if it ever needed to; every function guards its browser access.
 */

export type PerfMode = "full" | "lite";

/** Escape hatch for the user: setting this key forces a tier and silences detection. */
export const PERF_STORAGE_KEY = "alex-study-perf";

/**
 * The user's explicit choice, if they made one. An unknown value counts as no choice, so a
 * typo in localStorage can never wedge the app into a tier by accident.
 */
export function forcedPerfMode(): PerfMode | null {
  try {
    const stored = localStorage.getItem(PERF_STORAGE_KEY);
    return stored === "lite" || stored === "full" ? stored : null;
  } catch {
    // Private-mode localStorage throws; treat as "no opinion".
    return null;
  }
}

/**
 * The pre-paint heuristic: cheap synchronous reads only. Deliberately conservative --
 * every device flagged here loses the glass before it was ever shown it, so the bar is
 * "signals that almost always mean a GPU that cannot hold blurred compositing", not
 * "might be slow". Borderline machines stay on full and are caught by the watchdog
 * instead, which measures what the hardware actually does.
 */
export function detectWeakDevice(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  /* <=4 GB of RAM is phones and low-end laptops; blurred compositing lives in GPU memory
     that such devices usually do not have to spare. Absent API means "no signal". */
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 4) {
    return true;
  }
  /* Data saver implies a constrained connection AND typically a constrained device; the
     lite background also costs dramatically less bandwidth-adjacent battery. */
  const connection = (nav as { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return true;
  /* Few cores plus a coarse pointer approximates phone/tablet-class silicon, where Safari's
     backdrop-filter implementation is the single biggest jank source in the app. Desktops
     with few cores but real GPUs must not be flagged here -- the watchdog will catch the
     genuinely slow ones. */
  const cores = nav.hardwareConcurrency ?? 0;
  if (cores > 0 && cores <= 6 && window.matchMedia("(pointer: coarse)").matches) return true;
  return false;
}
