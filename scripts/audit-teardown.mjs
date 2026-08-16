/**
 * Deletes the throwaway audit accounts created by audit-bootstrap.mjs,
 * using the app's own DELETE /api/me endpoint. Leaves every other row untouched.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const ACCOUNTS = [
  { collegeId: "QA-AUDIT-A", academicYear: 3, password: "AuditPass2026!" },
  { collegeId: "QA-AUDIT-B", academicYear: 3, password: "AuditPass2026!" },
];

const browser = await chromium.launch();
for (const acct of ACCOUNTS) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="collegeId"]', acct.collegeId);
    await page.selectOption('select[name="academicYear"]', String(acct.academicYear));
    await page.fill('input[name="password"]', acct.password);
    await page.click("form.auth-form button.primary-button");
    await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30000 });
    const res = await page.request.delete(`${BASE}/api/me`, { data: { password: acct.password } });
    console.log(`[delete] ${acct.collegeId} -> ${res.status()} ${await res.text()}`);
  } catch (err) {
    console.log(`[delete] ${acct.collegeId} skipped: ${String(err).slice(0, 120)}`);
  }
  await ctx.close();
}
await browser.close();
