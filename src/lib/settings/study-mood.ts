/**
 * The single study mood vocabulary, shared by the server and the browser.
 *
 * This deliberately lives outside any `"use client"` module: the root layout is a Server
 * Component and needs `moodFromEnum` to stamp `data-mood` onto <html> during SSR, and a
 * plain function exported from a client module cannot be called from the server.
 * `applyMood` only touches `document`/`window` inside its body, so this module is still
 * safe to evaluate on the server.
 */

export type StudyMood = "notebook" | "cosmic" | "aurora" | "sunset" | "sakura";

/** Prisma's enum is upper-case; `data-mood` and the CSS palettes are lower-case. */
export type StudyMoodEnum = "NOTEBOOK" | "SAKURA" | "COSMIC" | "AURORA" | "SUNSET";

export const MOOD_STORAGE_KEY = "alex-study-bg-mood";

export const STUDY_MOOD_IDS: readonly StudyMood[] = [
  "notebook",
  "sakura",
  "cosmic",
  "aurora",
  "sunset",
];

const MOOD_ENUM: Record<StudyMood, StudyMoodEnum> = {
  notebook: "NOTEBOOK",
  sakura: "SAKURA",
  cosmic: "COSMIC",
  aurora: "AURORA",
  sunset: "SUNSET",
};

export function moodFromEnum(value: string | null | undefined): StudyMood {
  const mood = (value ?? "").toLowerCase() as StudyMood;
  return STUDY_MOOD_IDS.includes(mood) ? mood : "notebook";
}

/** The inverse, for the sign-up wizard: it holds the lower-case id (that is what `applyMood`
 *  previews with) and has to post the enum the API expects. */
export function moodToEnum(mood: StudyMood): StudyMoodEnum {
  return MOOD_ENUM[mood];
}

/**
 * The one swatch per mood, for anything that has to show the palettes side by side before
 * one of them is applied: the mood cards, the ribbon on the auth pages.
 *
 * Here rather than in study-background-selector.tsx because that module is `"use client"`,
 * and a Server Component importing a plain value across that boundary gets a client
 * reference rather than the array itself. The selector reads these back out.
 */
export const MOOD_SWATCH: Record<StudyMood, string> = {
  notebook: "#49B6E5",
  sakura: "#EC4899",
  cosmic: "#8B5CF6",
  aurora: "#10B981",
  sunset: "#F59E0B",
};

/**
 * Paint a mood everywhere it is read: the root attribute (which drives the whole palette),
 * localStorage, and a synthetic storage event. The synthetic event matters -- the real one
 * never fires on the tab that wrote the value, so sibling pickers would drift out of sync.
 */
export function applyMood(mood: StudyMood) {
  try {
    document.documentElement.dataset.mood = mood;
    localStorage.setItem(MOOD_STORAGE_KEY, mood);
    window.dispatchEvent(new StorageEvent("storage", { key: MOOD_STORAGE_KEY, newValue: mood }));
  } catch {
    // Private-mode localStorage throws; the root attribute is what actually matters.
  }
}

/** Persist the mood so it survives a new device or a cleared browser. Throws on failure so
 *  callers can roll their optimistic update back. */
export async function saveMood(mood: StudyMood) {
  const response = await fetch("/api/me/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ studyMood: MOOD_ENUM[mood] }),
  });
  if (!response.ok) throw new Error("Could not save the study mood");
}
