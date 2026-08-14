import { afterEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearMemoryRateLimits } from "@/lib/http/rate-limit";
import {
  deleteAccountSchema,
  profileSettingsSchema,
  studyPreferencesSchema,
} from "@/lib/settings/validation";

afterEach(() => clearMemoryRateLimits());

describe("Phase 11 launch hardening", () => {
  it("blocks requests beyond a fixed-window limit and resets in the next window", async () => {
    const policy = { name: "test", limit: 2, windowSeconds: 60 };
    expect((await checkRateLimit("student", policy, 1_000)).allowed).toBe(true);
    expect((await checkRateLimit("student", policy, 2_000)).allowed).toBe(true);
    expect((await checkRateLimit("student", policy, 3_000)).allowed).toBe(false);
    expect((await checkRateLimit("student", policy, 61_000)).allowed).toBe(true);
  });

  it("validates bounded profile and study preferences", () => {
    expect(profileSettingsSchema.safeParse({ locale: "AR", academicYear: 6 }).success).toBe(true);
    expect(studyPreferencesSchema.safeParse({ defaultFocusMinutes: 121 }).success).toBe(false);
  });

  it("requires password plus the exact deletion phrase", () => {
    expect(
      deleteAccountSchema.safeParse({ password: "secret", confirmation: "delete" }).success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ password: "secret", confirmation: "DELETE" }).success,
    ).toBe(true);
  });
});
