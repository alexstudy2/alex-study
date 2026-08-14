import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = ["/sign-in", "/sign-up", "/forgot-password", "/manual-reset"];

for (const route of publicRoutes) {
  test(`${route} renders without serious accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("h2")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      ),
    ).toEqual([]);
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });
}

test("root routes visitors to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("unsafe cross-origin API requests are rejected before route execution", async ({
  request,
}) => {
  const response = await request.post("/api/auth/forgot-password", {
    headers: { Origin: "https://example.invalid" },
    data: { collegeId: "MED-0001" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toEqual({ error: "cross_origin_request" });
});
