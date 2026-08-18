/**
 * Responsive / CSS audit harness.
 * Signs in with the seeded demo user, walks every route at several viewports and
 * reports (a) documents that scroll horizontally, (b) the specific elements that
 * stick out past the viewport, (c) undersized tap targets, (d) console errors.
 *
 * Usage: node scripts/responsive-audit.mjs [--shots]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
const SHOTS = process.argv.includes("--shots");
// `--only=/calendar,/tasks` re-checks a single fix without paying for all 31 routes.
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const OUT = "audit-out";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "desktop-1440", width: 1440, height: 900, mobile: false },
];

const STATIC_ROUTES = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/manual-reset",
  "/reset-password/audit-invalid-token",
  "/dashboard",
  "/tasks",
  "/focus",
  "/sessions",
  "/calendar",
  "/goals",
  "/analytics",
  "/insights",
  "/exam-plans/new",
  "/lobbies",
  "/lobbies/create",
  "/lobbies/join",
  "/challenges",
  "/challenges/new",
  "/leaderboard",
  "/friends",
  "/notifications",
  "/settings",
  "/onboarding/privacy",
];

/** Pages we scrape to find real ids for the dynamic routes. */
const RESERVED = /\/(new|create|join|edit|settings|result|history|stats)$/;
const DISCOVER = [
  { from: "/tasks", pattern: /^\/tasks\/[^/]+$/ },
  { from: "/sessions", pattern: /^\/sessions\/[^/]+$/ },
  { from: "/goals", pattern: /^\/goals\/[^/]+$/ },
  { from: "/challenges", pattern: /^\/challenges\/[^/]+$/ },
  { from: "/lobbies", pattern: /^\/lobbies\/[^/]+$/ },
  { from: "/insights", pattern: /^\/exam-plans\/[^/]+$/ },
];

const overflowProbe = () => {
  const docEl = document.documentElement;
  const vw = docEl.clientWidth;
  const results = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (style.position === "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const right = r.right + window.scrollX;
    const left = r.left + window.scrollX;
    if (right > vw + 1 || left < -1) {
      // Ignore elements inside a deliberately x-scrollable ancestor.
      let p = el.parentElement;
      let scrollable = false;
      while (p) {
        const ps = getComputedStyle(p);
        if (ps.overflowX === "auto" || ps.overflowX === "scroll" || ps.overflowX === "hidden") {
          scrollable = true;
          break;
        }
        p = p.parentElement;
      }
      if (scrollable) continue;
      results.push({
        el,
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 110),
        w: Math.round(r.width),
        left: Math.round(left),
        right: Math.round(right),
        over: Math.round(right - vw),
        text: (el.textContent ?? "").trim().slice(0, 45),
      });
    }
  }
  // Keep only the outermost offenders (drop children of already-listed nodes).
  const offenderEls = results.map((r) => r.el);
  const outermost = results.filter(
    (r) => !offenderEls.some((other) => other !== r.el && other.contains(r.el)),
  );
  for (const r of results) delete r.el;
  const tiny = [];
  for (const el of document.querySelectorAll(
    "button, a[href], input, select, [role=button], summary",
  )) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height < 28 || r.width < 24) {
      tiny.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === "string" ? el.className : "").slice(0, 80),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (el.textContent ?? "").trim().slice(0, 35),
      });
    }
  }
  // Containers whose content is wider than their own box: either silently clipped
  // (overflow hidden) or turned into a nested sideways scroller. `.app-content` has
  // overflow-x:auto, so document-level scrollWidth stays clean while content is cut off.
  const clipped = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    if (el.clientWidth === 0) continue;
    // Deliberate scrollers opt out via this attribute.
    if (el.closest("[data-x-scroll]")) continue;
    const cls = typeof el.className === "string" ? el.className : "";
    // Tables/pre/code are conventionally allowed to scroll inside a wrapper.
    if (/\b(x-scroll|table-scroll|overflow-x-auto)\b/.test(cls)) continue;
    if (["table", "pre", "code", "textarea", "input", "select"].includes(el.tagName.toLowerCase()))
      continue;
    clipped.push({
      tag: el.tagName.toLowerCase(),
      cls: cls.slice(0, 90),
      clientW: el.clientWidth,
      scrollW: el.scrollWidth,
      hidden: el.scrollWidth - el.clientWidth,
      overflowX: style.overflowX,
      text: (el.textContent ?? "").trim().slice(0, 40),
    });
  }
  // Only the outermost clipper matters — children inherit the squeeze.
  return {
    scrollWidth: docEl.scrollWidth,
    clientWidth: vw,
    bodyScrollWidth: document.body.scrollWidth,
    overflowing: outermost.slice(0, 25),
    overflowCount: results.length,
    clipped: clipped.sort((a, b) => b.hidden - a.hidden).slice(0, 12),
    tiny: tiny.slice(0, 15),
  };
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = [];

  // ---- auth once, reuse storage state -------------------------------------
  const authCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const authPage = await authCtx.newPage();
  let loggedIn = false;
  for (let attempt = 1; attempt <= 3 && !loggedIn; attempt++) {
    await authPage.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
    // The sign-in form has no `action`/`method`, so a click landing before React hydrates
    // submits it natively as a GET and the page just reloads itself with the credentials in
    // the query string. Wait for the client bundle to settle before touching anything.
    await authPage.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await authPage.waitForTimeout(1200);
    await authPage.fill('input[name="collegeId"]', process.env.AUDIT_ID ?? "QA-AUDIT-A");
    await authPage.selectOption('select[name="academicYear"]', process.env.AUDIT_YEAR ?? "3");
    await authPage.fill('input[name="password"]', process.env.AUDIT_PW ?? "AuditPass2026!");
    await authPage.click("form.auth-form button.primary-button");
    await authPage
      .waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30000 })
      .catch(() => {});
    loggedIn = !authPage.url().includes("sign-in");
    if (!loggedIn) console.log(`[auth] attempt ${attempt} failed -> ${authPage.url()}`);
  }
  console.log(`[auth] logged in: ${loggedIn} -> ${authPage.url()}`);
  if (!loggedIn) {
    console.log(await authPage.locator("body").innerText().catch(() => ""));
    throw new Error("auth failed — run scripts/audit-bootstrap.mjs first; audit would be meaningless");
  }
  const storageState = await authCtx.storageState();

  // ---- discover dynamic route ids ----------------------------------------
  const dynamicRoutes = [];
  for (const { from, pattern } of DISCOVER) {
    let hrefs = [];
    for (let attempt = 0; attempt < 3 && hrefs.length === 0; attempt++) {
      try {
        await authPage.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded" });
        await authPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await authPage.waitForTimeout(1500);
        hrefs = await authPage.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      } catch {
        await authPage.waitForTimeout(1000);
      }
    }
    const hit = hrefs.find((h) => h && pattern.test(h.split("?")[0]) && !RESERVED.test(h.split("?")[0]));
    if (hit) dynamicRoutes.push(hit.split("?")[0]);
    else console.log(`[discover] no match for ${pattern} on ${from}`);
  }
  // Extra nested routes derived from what we found.
  const room = dynamicRoutes.find((r) => r.startsWith("/lobbies/"));
  if (room) dynamicRoutes.push(`${room}/settings`);
  const challenge = dynamicRoutes.find((r) => /^\/challenges\/[^/]+$/.test(r));
  if (challenge) dynamicRoutes.push(`${challenge}/result`);
  await authCtx.close();

  const routes = [...STATIC_ROUTES, ...dynamicRoutes].filter(
    (r) => ONLY.length === 0 || ONLY.includes(r),
  );
  console.log(`[routes] auditing ${routes.length}:\n  ${routes.join("\n  ")}`);

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      storageState,
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });

    for (const route of routes) {
      consoleErrors.length = 0;
      let status = "ok";
      try {
        const resp = await page.goto(`${BASE}${route}`, {
          waitUntil: "domcontentloaded",
          timeout: 45000,
        });
        status = String(resp?.status() ?? "?");
        await page.waitForTimeout(1400);
      } catch (err) {
        report.push({ vp: vp.name, route, error: String(err).slice(0, 140) });
        continue;
      }
      let probe = null;
      for (let attempt = 0; attempt < 3 && !probe; attempt++) {
        try {
          await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
          probe = await page.evaluate(overflowProbe);
        } catch (err) {
          if (attempt === 2) {
            report.push({ vp: vp.name, route, error: String(err).slice(0, 140) });
          }
          await page.waitForTimeout(1200);
        }
      }
      if (!probe) continue;
      const entry = {
        vp: vp.name,
        route,
        status,
        url: page.url().replace(BASE, ""),
        hScroll: probe.scrollWidth - probe.clientWidth,
        overflowing: probe.overflowing,
        clipped: probe.clipped,
        tiny: vp.mobile ? probe.tiny : [],
        consoleErrors: [...consoleErrors],
      };
      report.push(entry);
      if (entry.hScroll > 1 || entry.overflowing.length || entry.clipped.length) {
        console.log(
          `[${vp.name}] ${route} hScroll=+${entry.hScroll} offenders=${entry.overflowing.length} clipped=${entry.clipped.length}`,
        );
        for (const o of entry.overflowing.slice(0, 4)) {
          console.log(`    OVER  ${o.tag}.${o.cls} w=${o.w} over=+${o.over} "${o.text}"`);
        }
        for (const c of entry.clipped.slice(0, 5)) {
          console.log(
            `    CLIP  ${c.tag}.${c.cls} ${c.clientW}<-${c.scrollW} hidden=${c.hidden} ovfX=${c.overflowX}`,
          );
        }
      }
      if (SHOTS) {
        const safe = route.replace(/[^a-z0-9]/gi, "_");
        await page
          .screenshot({ path: `${OUT}/${vp.name}${safe}.png`, fullPage: true })
          .catch(() => {});
      }
    }
    await ctx.close();
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));

  // ---- summary -----------------------------------------------------------
  console.log("\n================ SUMMARY ================");
  const bad = report.filter((r) => (r.hScroll ?? 0) > 1 || (r.overflowing?.length ?? 0) > 0);
  console.log(`pages with document-level horizontal overflow: ${bad.length} / ${report.length}`);
  const byRoute = new Map();
  for (const b of bad) {
    if (!byRoute.has(b.route)) byRoute.set(b.route, []);
    byRoute.get(b.route).push(`${b.vp}(+${b.hScroll})`);
  }
  for (const [route, vps] of byRoute) console.log(`  ${route} :: ${vps.join(", ")}`);

  console.log("\n---- clipped / nested-scroll containers (content cut off) ----");
  const clipRoutes = new Map();
  const clipSel = new Map();
  for (const r of report) {
    if (!r.clipped?.length) continue;
    const key = `${r.route}`;
    if (!clipRoutes.has(key)) clipRoutes.set(key, new Set());
    for (const c of r.clipped) {
      clipRoutes.get(key).add(`${r.vp}`);
      const s = `${c.tag}.${c.cls}`;
      if (!clipSel.has(s)) clipSel.set(s, { max: 0, routes: new Set(), vps: new Set() });
      const e = clipSel.get(s);
      e.max = Math.max(e.max, c.hidden);
      e.routes.add(r.route);
      e.vps.add(r.vp);
    }
  }
  console.log(`routes affected: ${clipRoutes.size}`);
  for (const [route, vps] of clipRoutes) console.log(`  ${route} :: ${[...vps].join(", ")}`);
  console.log("\n---- worst clipping selectors ----");
  for (const [s, e] of [...clipSel.entries()].sort((a, b) => b[1].max - a[1].max).slice(0, 30)) {
    console.log(
      `  hidden=${String(e.max).padStart(4)}px  ${s}\n        vps=[${[...e.vps].join(",")}] routes=${[...e.routes].slice(0, 5).join(",")}`,
    );
  }

  console.log("\n---- console errors ----");
  for (const r of report) {
    if (r.consoleErrors?.length) console.log(`  [${r.vp}] ${r.route}: ${r.consoleErrors[0]}`);
  }

  console.log("\n---- tiny tap targets (mobile) ----");
  const tinySeen = new Map();
  for (const r of report) {
    for (const t of r.tiny ?? []) {
      const key = `${t.tag}.${t.cls}`;
      if (!tinySeen.has(key)) tinySeen.set(key, { ...t, routes: new Set() });
      tinySeen.get(key).routes.add(r.route);
    }
  }
  for (const [key, v] of tinySeen) {
    console.log(`  ${key} ${v.w}x${v.h} "${v.text}" (${[...v.routes].slice(0, 3).join(", ")})`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
