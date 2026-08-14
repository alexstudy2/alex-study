import { describe, expect, it } from "vitest";
import { generatedInsightSchema } from "@/lib/insights/ai";
import { analyticsQuerySchema } from "@/lib/analytics/validation";

describe("analytics query validation", () => {
  it("accepts bounded ISO ranges and optional subject ownership keys", () => {
    expect(
      analyticsQuerySchema.safeParse({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-08-31T23:59:59.000Z",
      }).success,
    ).toBe(true);
    expect(analyticsQuerySchema.safeParse({ subjectId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("AI insight validation boundary", () => {
  it("accepts only supported, concise structured insights", () => {
    expect(
      generatedInsightSchema.safeParse({
        type: "BEST_TIME",
        title: "Evenings are steady",
        content: "Your completed sessions were most consistent in the evening.",
      }).success,
    ).toBe(true);
    expect(
      generatedInsightSchema.safeParse({ type: "DIAGNOSIS", title: "x", content: "y" }).success,
    ).toBe(false);
  });
});
