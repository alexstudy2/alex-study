/**
 * Screenshots + behaviour check for the mobile navigation top sheet (Phase 1).
 * Usage: node scripts/sheet-check.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const OUT = "audit-out/sheet";

async function signIn(page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.fill('input[name="collegeId"]', process.env.AUDIT_ID ?? "QA-AUDIT-A");
    await page.selectOption('select[name="academicYear"]', process.env.AUDIT_YEAR ?? "3");
    await page.fill('input[name="password"]', process.env.AUDIT_PW ?? "AuditPass2026!");
    await page.click("form.auth-form button.primary-button");
    await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30000 }).catch(() => {});
    if (!page.url().includes("sign-in")) return true;
    console.log(`[auth] attempt ${attempt} failed -> ${page.url()}`);
  }
  return false;
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const dir of ["ltr", "rtl"]) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  if (!(await signIn(page))) throw new Error("auth failed — run scripts/audit-bootstrap.mjs first");

  // Flip locale so the RTL pass renders Arabic from the server.
  if (dir === "rtl") {
    await page.request.patch(`${BASE}/api/me/preferences`, { data: { locale: "AR" } });
  } else {
    await page.request.patch(`${BASE}/api/me/preferences`, { data: { locale: "EN" } });
  }

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const htmlDir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
  check(`[${dir}] page dir is ${dir}`, htmlDir === dir, `got ${htmlDir}`);

  const trigger = page.locator(".mobile-more-trigger");
  check(`[${dir}] More trigger visible`, await trigger.isVisible());
  await page.screenshot({ path: `${OUT}/${dir}-01-closed.png` });

  const sheet = page.locator(".mobile-more-sheet");
  check(
    `[${dir}] sheet hidden before open`,
    (await sheet.evaluate((el) => getComputedStyle(el).visibility)) === "hidden"
  );

  // --- open -----------------------------------------------------------------
  await trigger.click();
  await page.waitForTimeout(400);
  check(`[${dir}] sheet visible after tap`, await sheet.isVisible());
  check(
    `[${dir}] aria-expanded true`,
    (await trigger.getAttribute("aria-expanded")) === "true"
  );
  check(
    `[${dir}] trigger shows X icon`,
    (await trigger.locator("svg.lucide-x").count()) === 1
  );
  check(
    `[${dir}] sheet flush with top of viewport`,
    (await sheet.evaluate((el) => Math.round(el.getBoundingClientRect().top))) === 0
  );
  check(
    `[${dir}] focus moved into sheet`,
    await page.evaluate(() => !!document.activeElement?.closest(".mobile-more-sheet"))
  );
  check(
    `[${dir}] body scroll locked`,
    await page.evaluate(() => document.body.classList.contains("mobile-sheet-open"))
  );
  const dialog = await sheet.evaluate((el) => ({
    role: el.getAttribute("role"),
    modal: el.getAttribute("aria-modal"),
    label: el.getAttribute("aria-label"),
  }));
  check(
    `[${dir}] dialog semantics`,
    dialog.role === "dialog" && dialog.modal === "true" && !!dialog.label,
    JSON.stringify(dialog)
  );
  const tiles = await page.locator(".mobile-more-tile").count();
  check(`[${dir}] 12 nav tiles rendered`, tiles === 12, `got ${tiles}`);
  const moodCards = await page.locator(".study-mood-card").count();
  check(`[${dir}] 5 mood cards rendered`, moodCards === 5, `got ${moodCards}`);

  // Tap targets inside the sheet.
  const small = await page.evaluate(() => {
    const out = [];
    document
      .querySelectorAll(".mobile-more-sheet a, .mobile-more-sheet button")
      .forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.width < 44 || r.height < 44)) {
          out.push(`${el.className}: ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      });
    return out;
  });
  check(`[${dir}] all sheet tap targets >= 44px`, small.length === 0, small.join("; "));

  const overflow = await page.evaluate(() => {
    const el = document.querySelector(".mobile-more-sheet");
    const r = el.getBoundingClientRect();
    return { right: Math.round(r.right), width: Math.round(r.width), vw: window.innerWidth };
  });
  check(
    `[${dir}] sheet does not overflow horizontally`,
    overflow.width <= overflow.vw,
    JSON.stringify(overflow)
  );

  await page.screenshot({ path: `${OUT}/${dir}-02-open.png` });

  // Scrolled to the bottom of the sheet body.
  await page.locator(".mobile-more-body").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${dir}-03-open-bottom.png` });

  // --- Escape closes --------------------------------------------------------
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check(
    `[${dir}] Escape closes sheet`,
    (await sheet.evaluate((el) => getComputedStyle(el).visibility)) === "hidden"
  );
  check(
    `[${dir}] focus returned to trigger`,
    await page.evaluate(() =>
      document.activeElement?.classList.contains("mobile-more-trigger")
    )
  );
  check(
    `[${dir}] scroll lock released`,
    await page.evaluate(() => !document.body.classList.contains("mobile-sheet-open"))
  );

  // --- backdrop tap closes --------------------------------------------------
  await trigger.click();
  await page.waitForTimeout(400);
  await page.locator(".mobile-more-backdrop").click({ position: { x: 195, y: 820 } });
  await page.waitForTimeout(400);
  check(
    `[${dir}] backdrop tap closes sheet`,
    (await sheet.evaluate((el) => getComputedStyle(el).visibility)) === "hidden"
  );

  // --- navigating from the sheet closes it ---------------------------------
  await trigger.click();
  await page.waitForTimeout(400);
  await page.locator('.mobile-more-tile[href="/goals"]').click();
  await page.waitForURL((u) => u.pathname === "/goals", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  check(`[${dir}] navigated to /goals`, new URL(page.url()).pathname === "/goals", page.url());
  check(
    `[${dir}] sheet closed after navigation`,
    (await sheet.evaluate((el) => getComputedStyle(el).visibility)) === "hidden"
  );
  await page.screenshot({ path: `${OUT}/${dir}-04-after-nav.png` });

  // --- mood card selection --------------------------------------------------
  await trigger.click();
  await page.waitForTimeout(400);
  await page.locator(".study-mood-card").nth(2).click();
  await page.waitForTimeout(400);
  const mood = await page.evaluate(() => document.documentElement.dataset.mood);
  check(`[${dir}] mood card applies data-mood`, mood === "cosmic", `got ${mood}`);
  await page.screenshot({ path: `${OUT}/${dir}-05-mood-cosmic.png` });

  check(`[${dir}] no console errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
  await ctx.close();
}

// Desktop: the sheet must never show, and the old details popover must be gone.
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
if (!(await signIn(dpage))) throw new Error("auth failed");
await dpage.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
await dpage.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await dpage.waitForTimeout(1000);
check(
  "[desktop] More trigger hidden",
  !(await dpage.locator(".mobile-more-trigger").isVisible())
);
check(
  "[desktop] sheet display:none",
  (await dpage.locator(".mobile-more-sheet").evaluate((el) => getComputedStyle(el).display)) ===
    "none"
);
check("[desktop] no leftover <details> in nav", (await dpage.locator(".mobile-navigation details").count()) === 0);
await dpage.screenshot({ path: `${OUT}/desktop-sidebar.png` });
await dctx.close();

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILURES:");
  failed.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  process.exitCode = 1;
}
