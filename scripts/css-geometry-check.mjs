/**
 * Layout regression check for the responsive fixes -- no database, no dev server.
 *
 * scripts/responsive-audit.mjs is the broader tool, but it needs a signed-in session and a
 * reachable database. Every fix this guards is pure CSS geometry, so it can be checked in
 * isolation: compile the app's real stylesheet chain (globals.css, which imports
 * tokens/base/shell/components, through the same @tailwindcss/postcss plugin Next uses) and
 * measure fixtures/css-geometry.html, which reproduces the affected markup verbatim.
 *
 * The fixture data is deliberately harsher than real rows -- long nowrap event titles, three
 * events crammed in one month cell, the widest three-label nav pill -- so a pass here is a
 * stronger signal than a pass against whatever happens to be seeded.
 *
 * Usage: node scripts/css-geometry-check.mjs   (exits non-zero on any finding)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const DIR = "scripts/fixtures";
const ENTRY = `${DIR}/.entry.css`;
// The @source lines are explicit because the generated CSS sits in a gitignored path and
// Tailwind v4's automatic source detection honours .gitignore -- utilities used only by the
// fixture (min-h-6) would otherwise never be generated.
writeFileSync(
  ENTRY,
  '@import "../../src/app/globals.css";\n@source "./css-geometry.html";\n@source "../../src";\n',
);

const css = (await postcss([tailwind()]).process(readFileSync(ENTRY, "utf8"), { from: ENTRY })).css;
writeFileSync(`${DIR}/css-geometry.css`, css);
console.log(`[css] compiled ${css.length} bytes`);
for (const probe of [".min-h-6", "--primary:", ".calendar-day", ".notebook-filter-tabs", ".lobby-form"]) {
  console.log(`  ${css.includes(probe) ? "present" : "MISSING"}  ${probe}`);
}

const SECTIONS = [
  ["fx-calendar", "/calendar month grid", [".month-grid", ".calendar-day", ".calendar-day > div"]],
  ["fx-week", "/calendar week grid", [".week-grid", ".week-day", ".week-day-events"]],
  ["fx-tabs", "/tasks filter pill", [".notebook-filter-tabs"]],
  ["fx-pill", "page-header nav pill", [".page-header-container", ".page-header-actions", ".page-header"]],
  ["fx-orbit", "score-orbit", [".score-orbit"]],
  ["fx-lobbyform", "/lobbies/create form", [".lobby-form", ".lobby-form label", ".form-grid"]],
  ["fx-analytics", "/analytics workspace", [".analytics-workspace", ".analytics-sidebar", ".analytics-main"]],
  ["fx-lobbystudio", "/lobbies/:id studio", [".lobby-studio-grid", ".lobby-primary-column"]],
  ["fx-taskrow", "task-row controls", [".sticky-task-note", ".task-row-left"]],
];

const TAP = [
  ".drag-grip-btn",
  ".task-checkbox-btn",
  ".task-complete-btn",
  ".task-subtasks-pill",
  ".calendar-event",
  'input[type="checkbox"]',
  'input[type="radio"]',
  ".page-header-main a",
];

const browser = await chromium.launch();
let fail = 0;

for (const [theme, mood] of [
  ["light", "notebook"],
  ["dark", "cosmic"],
  ["girly", "sakura"],
]) {
  for (const [w, h, mobile] of [
    [320, 800, true],
    [360, 800, true],
    [390, 844, true],
    [768, 1024, true],
    [1440, 900, false],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(`file:///${process.cwd().replace(/\\/g, "/")}/${DIR}/css-geometry.html`);
    await page.evaluate(
      ([t, m]) => {
        document.documentElement.dataset.theme = t;
        document.documentElement.dataset.mood = m;
      },
      [theme, mood],
    );
    await page.waitForTimeout(120);

    const res = await page.evaluate(
      ({ SECTIONS, TAP }) => {
        const vw = document.documentElement.clientWidth;
        const out = { vw, doc: document.documentElement.scrollWidth - vw, clipped: [], tiny: [], viaLabel: [] };
        for (const [id, label, sels] of SECTIONS) {
          const root = document.getElementById(id);
          if (!root) continue;
          for (const sel of sels) {
            for (const el of root.querySelectorAll(sel)) {
              const st = getComputedStyle(el);
              if (st.display === "none") continue;
              if (el.clientWidth === 0) continue;
              const hidden = el.scrollWidth - el.clientWidth;
              // overflow-x:auto here is the intended fix (a scroller), not a defect.
              if (hidden > 1 && st.overflowX === "visible") {
                out.clipped.push({ label, sel, clientW: el.clientWidth, scrollW: el.scrollWidth, hidden });
              }
              const r = el.getBoundingClientRect();
              if (Math.round(r.right) > vw + 1) {
                out.clipped.push({ label, sel, spill: Math.round(r.right - vw), w: Math.round(r.width) });
              }
            }
          }
        }
        for (const sel of TAP) {
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.height >= 24 && r.width >= 24) continue;
            // WCAG 2.5.8 measures the whole clickable region. Every native checkbox/radio in
            // this app sits inside a <label> with adjacent text, so clicking the label toggles
            // the input and the label is the real target -- report that box instead.
            const label = el.closest("label");
            if (label && label !== el) {
              const lr = label.getBoundingClientRect();
              if (lr.height >= 24 && lr.width >= 24) {
                out.viaLabel.push({ sel, w: +r.width.toFixed(1), h: +r.height.toFixed(1), lw: Math.round(lr.width), lh: Math.round(lr.height) });
                continue;
              }
            }
            out.tiny.push({ sel, w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
          }
        }
        return out;
      },
      { SECTIONS, TAP },
    );

    const tag = `${theme}/${mood} ${w}x${h}${mobile ? " coarse" : ""}`;
    const bad = res.doc > 1 || res.clipped.length || res.tiny.length;
    if (bad) fail++;
    console.log(`\n[${tag}] doc=+${res.doc} clipped=${res.clipped.length} tiny=${res.tiny.length}`);
    for (const c of res.clipped)
      console.log(
        `    ${c.spill !== undefined ? `SPILL +${c.spill}px w=${c.w}` : `CLIP ${c.clientW}<-${c.scrollW} (hidden ${c.hidden})`}  ${c.sel}   [${c.label}]`,
      );
    for (const t of res.tiny) console.log(`    TINY  ${t.sel} ${t.w}x${t.h}`);
    for (const t of res.viaLabel)
      console.log(`    ok(label) ${t.sel} ${t.w}x${t.h} -> clickable label ${t.lw}x${t.lh}`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${fail === 0 ? "PASS" : `FAIL: ${fail} combo(s) with findings`}`);
process.exit(fail === 0 ? 0 : 1);
