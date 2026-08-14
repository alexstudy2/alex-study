import { describe, expect, it } from "vitest";
import { credentialsSchema, registerSchema } from "@/lib/auth/validation";
import { hashResetToken } from "@/lib/auth/tokens";

describe("college authentication validation", () => {
  it("accepts a valid Alexandria medicine student registration", () => {
    expect(registerSchema.safeParse({ name: "Mariam Hassan", collegeId: "MED-2026-001", academicYear: 3, email: "", password: "AlexStudy2026!", locale: "EN" }).success).toBe(true);
  });
  it("accepts short college IDs from 1 to 4 digits", () => {
    expect(registerSchema.safeParse({ name: "Ahmed Ali", collegeId: "1", academicYear: 1, password: "Password123!", locale: "AR" }).success).toBe(true);
    expect(registerSchema.safeParse({ name: "Ahmed Ali", collegeId: "1234", academicYear: 1, password: "Password123!", locale: "AR" }).success).toBe(true);
  });
  it("rejects an academic year outside the six-year range", () => {
    expect(registerSchema.safeParse({ name: "Mariam Hassan", collegeId: "MED-1", academicYear: 7, password: "AlexStudy2026!", locale: "EN" }).success).toBe(false);
  });
  it("requires both college ID and password for credentials", () => {
    expect(credentialsSchema.safeParse({ collegeId: "MED-2026-001", password: "" }).success).toBe(false);
  });
  it("hashes reset tokens deterministically without storing the raw token", () => {
    const raw = "a".repeat(64);
    expect(hashResetToken(raw)).toHaveLength(64);
    expect(hashResetToken(raw)).not.toBe(raw);
    expect(hashResetToken(raw)).toBe(hashResetToken(raw));
  });
});
