/**
 * The bounds for the study-rhythm preferences, in one place.
 *
 * These are enforced in two schemas now -- `studyPreferencesSchema` for the Settings page and
 * `signupPreferencesSchema` for the sign-up wizard -- and the steppers in the wizard clamp to
 * them client-side. Three copies of "5 to 120" is three chances for one of them to drift.
 *
 * The defaults mirror the column defaults on `UserPreference` (prisma/schema.prisma), so a
 * wizard that is never touched writes the same values Prisma would have written anyway.
 */

export type MinuteLimit = {
  min: number;
  max: number;
  default: number;
  /** Stepper increment. Focus moves in 5s; the short break is short enough to need 1s. */
  step: number;
};

export const FOCUS_MINUTES: MinuteLimit = { min: 5, max: 120, default: 25, step: 5 };
export const SHORT_BREAK_MINUTES: MinuteLimit = { min: 1, max: 30, default: 5, step: 1 };
export const LONG_BREAK_MINUTES: MinuteLimit = { min: 5, max: 60, default: 15, step: 5 };
export const POMODOROS_BEFORE_LONG_BREAK: MinuteLimit = { min: 1, max: 12, default: 4, step: 1 };
export const AMBIENT_VOLUME = { min: 0, max: 100, default: 35, step: 5 } as const;

/** Ready-made rhythms, so the common case is one tap instead of six. */
export const RHYTHM_PRESETS = [
  { id: "classic", focus: 25, shortBreak: 5, longBreak: 15 },
  { id: "deep", focus: 50, shortBreak: 10, longBreak: 20 },
  { id: "gentle", focus: 15, shortBreak: 5, longBreak: 10 },
] as const;

export type RhythmPresetId = (typeof RHYTHM_PRESETS)[number]["id"];
