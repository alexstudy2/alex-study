/**
 * The single skin vocabulary, shared by the server and the browser.
 *
 * A skin is the *material* system -- radius, border, shadow, blur. It is deliberately a
 * second axis alongside the study mood, which owns the *palette*. `data-mood` picks which
 * colours; `data-skin` picks what the surfaces are made of. Either can change without
 * touching the other, which is what lets the original doodle look stay available as a
 * user choice instead of being deleted.
 *
 * Like study-mood.ts, this deliberately lives outside any `"use client"` module: the root
 * layout is a Server Component and needs `skinFromEnum` to stamp `data-skin` onto <html>
 * during SSR, and a plain function exported from a client module cannot be called from the
 * server. `applySkin` only touches `document`/`window` inside its body, so this module is
 * still safe to evaluate on the server.
 */

export type StudySkin = "atlas" | "doodle";

/** Prisma's enum is upper-case; `data-skin` and the CSS material blocks are lower-case. */
export type StudySkinEnum = "ATLAS" | "DOODLE";

export const SKIN_STORAGE_KEY = "alex-study-skin";

export const STUDY_SKIN_IDS: readonly StudySkin[] = ["atlas", "doodle"];

/** Atlas is the main design; doodle is the preserved classic. Anything unrecognised falls
 *  back here, so a bad DB value degrades to the intended default rather than no skin. */
export const DEFAULT_SKIN: StudySkin = "atlas";

const SKIN_ENUM: Record<StudySkin, StudySkinEnum> = {
  atlas: "ATLAS",
  doodle: "DOODLE",
};

export function skinFromEnum(value: string | null | undefined): StudySkin {
  const skin = (value ?? "").toLowerCase() as StudySkin;
  return STUDY_SKIN_IDS.includes(skin) ? skin : DEFAULT_SKIN;
}

/** The inverse, for the pickers: they hold the lower-case id (that is what `applySkin`
 *  previews with) and have to post the enum the API expects. */
export function skinToEnum(skin: StudySkin): StudySkinEnum {
  return SKIN_ENUM[skin];
}

/**
 * Paint a skin everywhere it is read: the root attribute (which drives every material
 * token), localStorage, and a synthetic storage event. The synthetic event matters -- the
 * real one never fires on the tab that wrote the value, so sibling pickers would drift out
 * of sync. Same contract as `applyMood`.
 */
export function applySkin(skin: StudySkin) {
  try {
    document.documentElement.dataset.skin = skin;
    localStorage.setItem(SKIN_STORAGE_KEY, skin);
    window.dispatchEvent(new StorageEvent("storage", { key: SKIN_STORAGE_KEY, newValue: skin }));
  } catch {
    // Private-mode localStorage throws; the root attribute is what actually matters.
  }
}

/** Persist the skin so it survives a new device or a cleared browser. Throws on failure so
 *  callers can roll their optimistic update back. */
export async function saveSkin(skin: StudySkin) {
  const response = await fetch("/api/me/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ skin: SKIN_ENUM[skin] }),
  });
  if (!response.ok) throw new Error("Could not save the visual style");
}
