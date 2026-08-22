import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    /* E2E used to exercise `next dev` only (audit M15): headers, minification and
       prod-only behaviour like the nonce CSP never got tested. Set E2E_PROD=1 (CI, or a
       release gate) to run against a real production build; the default keeps dev for
       fast inner-loop runs. */
    command: process.env.E2E_PROD
      ? "npm run build && npm run start -- --hostname 127.0.0.1 --port 3000"
      : "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/sign-in",
    reuseExistingServer: true,
    timeout: process.env.E2E_PROD ? 420_000 : 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"], channel: "chromium" } },
  ],
});
