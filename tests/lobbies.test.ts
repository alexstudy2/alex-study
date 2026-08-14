import { describe, expect, it } from "vitest";
import { canControlTimer, canModerate, hasCapacity } from "@/lib/lobbies/permissions";
import {
  messageSchema,
  reactionSchema,
  roomInputSchema,
  roomTimerSchema,
} from "@/lib/lobbies/validation";
describe("lobby permissions", () => {
  it("restricts timer and moderation controls", () => {
    expect(canControlTimer("OWNER")).toBe(true);
    expect(canControlTimer("MEMBER")).toBe(false);
    expect(canModerate("MODERATOR")).toBe(true);
  });
  it("enforces the room capacity ceiling", () => {
    expect(hasCapacity(24, 25)).toBe(true);
    expect(hasCapacity(25, 25)).toBe(false);
    expect(hasCapacity(10, 100)).toBe(true);
  });
});
describe("lobby validation", () => {
  it("bounds room creation and chat", () => {
    expect(
      roomInputSchema.safeParse({
        name: "Quiet room",
        maxMembers: 25,
        visibility: "PUBLIC",
        chatEnabled: true,
      }).success,
    ).toBe(true);
    expect(roomInputSchema.safeParse({ name: "x", maxMembers: 26 }).success).toBe(false);
    expect(messageSchema.safeParse({ body: "hello" }).success).toBe(true);
    expect(messageSchema.safeParse({ body: "" }).success).toBe(false);
  });
  it("allows only supported synchronized modes and reactions", () => {
    expect(roomTimerSchema.safeParse({ mode: "FOCUS", durationSeconds: 1500 }).success).toBe(true);
    expect(reactionSchema.safeParse({ sessionId: "not-uuid", reaction: "👏" }).success).toBe(false);
  });
});
