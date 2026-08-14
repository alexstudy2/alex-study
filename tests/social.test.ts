import { describe, expect, it } from "vitest";
import { isReminderEligible } from "@/lib/accountability/reminders";
import { canAcceptFriendship, canManagePair, canonicalPair } from "@/lib/social/pairs";
import {
  accountabilityPatchSchema,
  friendRequestSchema,
  notificationPreferencesSchema,
  searchQuerySchema,
} from "@/lib/social/validation";

describe("social relationship invariants", () => {
  it("uses one stable key for either participant order", () => {
    expect(canonicalPair("b", "a")).toEqual({ userAId: "a", userBId: "b", pairKey: "a:b" });
    expect(canonicalPair("a", "b").pairKey).toBe(canonicalPair("b", "a").pairKey);
  });

  it("allows only the pending addressee to accept a friend request", () => {
    const request = { addresseeId: "student-b", status: "PENDING" };
    expect(canAcceptFriendship(request, "student-b")).toBe(true);
    expect(canAcceptFriendship(request, "student-a")).toBe(false);
    expect(canAcceptFriendship({ ...request, status: "BLOCKED" }, "student-b")).toBe(false);
  });

  it("allows either accountability participant to manage the pair", () => {
    const pair = { userAId: "a", userBId: "b" };
    expect(canManagePair(pair, "a")).toBe(true);
    expect(canManagePair(pair, "b")).toBe(true);
    expect(canManagePair(pair, "c")).toBe(false);
  });
});

describe("social validation", () => {
  it("validates request IDs, searches, preferences, and pair states", () => {
    expect(
      friendRequestSchema.safeParse({ userId: "9d72e0f4-9d0d-4b16-a86f-f64da381c9fb" }).success,
    ).toBe(true);
    expect(searchQuerySchema.safeParse("a").success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
    expect(notificationPreferencesSchema.safeParse({ inAppNotifications: false }).success).toBe(
      true,
    );
    expect(accountabilityPatchSchema.safeParse({ status: "ENDED" }).success).toBe(false);
  });
});

describe("accountability reminder caps", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  it("requires 24 hours of inactivity", () => {
    expect(
      isReminderEligible({
        now,
        lastStudyAt: new Date("2026-08-13T11:59:59.000Z"),
        lastReminderAt: null,
      }),
    ).toBe(true);
    expect(
      isReminderEligible({
        now,
        lastStudyAt: new Date("2026-08-13T12:00:01.000Z"),
        lastReminderAt: null,
      }),
    ).toBe(false);
  });

  it("caps reminders to one per subject in 24 hours", () => {
    expect(
      isReminderEligible({
        now,
        lastStudyAt: null,
        lastReminderAt: new Date("2026-08-13T12:00:01.000Z"),
      }),
    ).toBe(false);
    expect(
      isReminderEligible({
        now,
        lastStudyAt: null,
        lastReminderAt: new Date("2026-08-13T12:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
