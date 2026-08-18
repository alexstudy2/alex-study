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
for (const probe of [".min-h-6", "--primary:", "--mobile-nav-total:", ".calendar-day", ".notebook-filter-tabs", ".lobby-form"]) {
  console.log(`  ${css.includes(probe) ? "present" : "MISSING"}  ${probe}`);
}

const SECTIONS = [
  ["fx-calendar", "/calendar month grid", [".month-grid", ".calendar-day", ".calendar-day > div"]],
  ["fx-week", "/calendar week grid", [".week-grid", ".week-day", ".week-day-events"]],
  ["fx-tabs", "/tasks header + chips", [".notebook-top-header", ".notebook-filter-tabs", ".header-branding", ".header-actions", ".subjects-ribbon", ".subjects-scroll"]],
  ["fx-pill", "page-header nav pill", [".page-header-container", ".page-header-main", ".page-header-text", ".page-header-actions", ".page-header"]],
  ["fx-orbit", "score-orbit", [".score-orbit"]],
  ["fx-lobbyform", "/lobbies/create form", [".lobby-form", ".lobby-form label", ".form-grid"]],
  ["fx-analytics", "/analytics workspace", [".analytics-workspace", ".analytics-sidebar", ".analytics-main"]],
  ["fx-lobbystudio", "/lobbies/:id studio", [".lobby-studio-grid", ".lobby-primary-column"]],
  ["fx-taskrow", "tasks notebook card", [".master-notebook-card", ".notebook-quick-add-line", ".notebook-tasks-surface", ".notebook-task-list", ".notebook-task-row", ".task-row-left", ".task-row-body", ".task-row-title-bar", ".task-row-badges", ".task-meta-pill"]],
  ["fx-timer", "/focus timer card", [".focus-main-grid", ".doodle-timer-card", ".timer-chart-head", ".timer-mode-segmented-tabs", ".timer-mode-tab", ".timer-status-row", ".timer-dial", ".timer-dial-inner", ".giant-timer-digits", ".timer-ecg", ".timer-vitals", ".timer-action-buttons", ".doodle-distraction-btn", ".focus-sidebar-card"]],
  ["fx-sidebar", "desktop sidebar", [".app-sidebar", ".sidebar-nav", ".sidebar-group", ".app-sidebar-footer", ".study-mood-sidebar-btn"]],
];

const TAP = [
  ".drag-grip-btn",
  ".task-checkbox-btn",
  ".task-complete-btn",
  ".task-subtasks-toggle",
  ".task-action-icon-btn",
  ".quick-add-options-toggle",
  ".notebook-manage-toggle",
  ".subject-chip",
  ".timer-mode-tab",
  ".calendar-event",
  'input[type="checkbox"]',
  'input[type="radio"]',
  ".page-header-main a",
];

const browser = await chromium.launch();
let fail = 0;

/* The mobile comfort block only wins on source order, and only against a base rule of
   equal specificity -- a bare `.foo` there does nothing if the base rule is `.bar.foo`.
   That is a silent failure, so rather than spot-check, read the selector list straight
   out of globals.css and prove every entry actually thins out at runtime. */
const DECO_SELECTORS = (() => {
  const src = readFileSync("src/app/globals.css", "utf8");
  const start = src.indexOf("--- 1. One step down");
  const head = src.slice(start, src.indexOf("box-shadow", start));
  return [...head.matchAll(/^\s*(\.[^,{\n]+?)\s*,\s*$/gm)].map((m) => m[1]).filter((s) => !s.startsWith("/*"));
})();
console.log(`[deco] ${DECO_SELECTORS.length} selectors in the mobile comfort block`);

/* Every mood in LTR, plus one RTL sweep. Arabic is half of this app's traffic and the
   failure mode is a physical property -- a padding-left or a margin-right that looks
   correct in English and lands on the wrong edge in Arabic. One mood is enough for that:
   direction is orthogonal to the palette, and nothing in tokens.css is direction-aware. */
const RUNS = [
  ...["notebook", "cosmic", "sakura", "aurora", "sunset"].map((m) => [m, "ltr"]),
  ["notebook", "rtl"],
];

for (const [mood, dir] of RUNS) {
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
      ({ m, d }) => {
        document.documentElement.dataset.mood = m;
        document.documentElement.dir = d;
      },
      { m: mood, d: dir },
    );
    /* Settle every animation instantly. Phase 7 put a 160ms slide on the timer's mode
       indicator, a 280ms entrance on the dial and an infinite breathing loop on the ring, and
       a harness that measures rectangles cannot measure them mid-flight: the first RTL run
       here reported the indicator 74px off its tab, which was not a layout bug at all but the
       slide caught at 95% of its travel. A zero duration with the fill mode intact lands each
       animation on its end state, and the breathing loop -- which has no fill mode -- falls
       back to scale(1) instead of oscillating the ring's width by 1.5% under the assertions. */
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important;" +
        " transition-duration: 0s !important; transition-delay: 0s !important; }",
    });
    await page.waitForTimeout(120);

    const res = await page.evaluate(
      ({ SECTIONS, TAP, DECO_SELECTORS }) => {
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
              // Both edges: in RTL an over-wide element hangs off the left, so a
              // right-edge-only test would report nothing and read as a pass.
              const over = Math.max(Math.round(r.right) - vw, -Math.round(r.left));
              if (over > 1) {
                out.clipped.push({ label, sel, spill: over, w: Math.round(r.width) });
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

        // ---- bottom-nav clearance ----
        // Scrolling the document to its end is what a user does to reach the last row of a
        // long page. `.app-content`'s bottom padding is the only thing between that row and
        // the fixed bar, so measuring it here catches the overlap directly rather than
        // re-deriving it from the stylesheet.
        const frame = document.getElementById("fx-navclear");
        const nav = frame?.querySelector(".mobile-navigation");
        const content = frame?.querySelector(".app-content");
        const lastLine = frame?.querySelector(".fx-last-line");
        if (nav && content && lastLine) {
          const shown = getComputedStyle(nav).display !== "none";
          const padB = parseFloat(getComputedStyle(content).paddingBottom);
          window.scrollTo(0, document.documentElement.scrollHeight);
          const navH = shown ? nav.getBoundingClientRect().height : 0;
          const navTop = shown ? nav.getBoundingClientRect().top : Infinity;
          out.nav = {
            shown,
            navH: Math.round(navH),
            padB: Math.round(padB),
            // The bar must be fully cleared, or long pages end underneath it.
            overlap: Math.round(Math.max(0, lastLine.getBoundingClientRect().bottom - navTop)),
            // And no dead strip where the bar is not rendered at all.
            wasted: shown ? 0 : Math.round(Math.max(0, padB - 20)),
          };
        }
        // ---- mobile decoration step-down ----
        // One throwaway node per selector, measured live. `border-width: 1.5px` renders
        // as 1px at a device ratio of 1, so the shadow is the signal that is checked
        // exactly; the border is only required to be thinner than the 2px base.
        out.deco = [];
        const probe = document.createElement("div");
        probe.style.cssText = "position:absolute;left:-9999px;top:0;width:200px";
        document.body.appendChild(probe);
        for (const sel of DECO_SELECTORS) {
          // Handles both `.card` / `.a.b` and the `.list article` descendant forms.
          const parts = sel.trim().split(/\s+/);
          let host = probe;
          let leaf = null;
          for (const part of parts) {
            const tag = part.startsWith(".") ? "div" : part;
            const el = document.createElement(part.startsWith(".") ? "div" : tag);
            for (const c of part.split(".").filter(Boolean)) el.classList.add(c);
            host.appendChild(el);
            host = el;
            leaf = el;
          }
          const st = getComputedStyle(leaf);
          out.deco.push({
            sel,
            bw: +parseFloat(st.borderTopWidth).toFixed(1),
            xs: /^1\.5px 1\.5px/.test(st.boxShadow.replace(/^rgba?\([^)]*\)\s*/, "")),
          });
        }
        probe.remove();

        // ---- secondary page header (Phase 5) ----
        // The header shadow steps down through --page-header-shadow, and a token declared in
        // the wrong `:root` block loses to `:root[data-mood="notebook"]` on specificity while
        // looking correct on the other four moods. That is exactly how the bottom-nav
        // clearance was lost, so the token is measured on every mood rather than trusted.
        const hdr = document.querySelector("#fx-pill .page-header-container");
        const badge = hdr?.querySelector(".header-icon-box");
        const h1 = hdr?.querySelector("h1");
        if (hdr && badge && h1) {
          const hs = getComputedStyle(hdr);
          const shadow = hs.boxShadow.replace(/^rgba?\([^)]*\)\s*/, "");
          const br = badge.getBoundingClientRect();
          out.hdr = {
            card: parseFloat(hs.borderTopWidth) >= 1 && hs.boxShadow !== "none" && parseFloat(hs.paddingTop) > 0,
            xs: /^1\.5px 1\.5px/.test(shadow),
            base: /^2px 2px/.test(shadow),
            h1: +parseFloat(getComputedStyle(h1).fontSize).toFixed(1),
            // A flex item with no `flex: 0 0 auto` gets crushed by a long title; the badge is
            // square by construction, so a squeeze shows up as width < height.
            badgeW: Math.round(br.width),
            badgeH: Math.round(br.height),
          };
        }

        // ---- tasks page mobile layout (Phase 6) ----
        // The three things this redesign claims and a stylesheet read cannot confirm: the
        // pinboard chrome is actually gone below the breakpoint, the per-card manage row is
        // gated by the data attribute rather than by a rule that lost on specificity, and
        // quick-add really does collapse to one line instead of stacking.
        const notebook = document.getElementById("fx-taskrow");
        const cards = notebook ? [...notebook.querySelectorAll(".notebook-task-row")] : [];
        const qline = notebook?.querySelector(".notebook-quick-add-line");
        if (cards.length === 2 && qline) {
          const [collapsed, expandedCard] = cards;
          const cs = getComputedStyle(collapsed);
          const tape = getComputedStyle(collapsed, "::before");
          const body = getComputedStyle(collapsed.querySelector(".task-row-body"));
          const qInput = qline.querySelector(".quick-add-input");
          const qSubmit = qline.querySelector(".quick-add-submit");
          const qOpts = qline.querySelector(".quick-add-options");
          out.task = {
            // rotate() lands in the matrix, so a tilt shows up as b/c being non-zero.
            tilted: cards.some((c) => {
              const m = new DOMMatrixReadOnly(getComputedStyle(c).transform);
              return Math.abs(m.b) > 0.001 || Math.abs(m.c) > 0.001;
            }),
            tape: tape.display !== "none" && tape.content !== "none",
            minH: Math.round(parseFloat(cs.minHeight) || 0),
            bodyMinH: Math.round(parseFloat(body.minHeight) || 0),
            // Same page, one card in each state: off must hide the row, on must show it.
            manageOff: getComputedStyle(collapsed.querySelector(".task-row-actions")).display,
            manageOn: getComputedStyle(expandedCard.querySelector(".task-row-actions")).display,
            optsHidden: getComputedStyle(qOpts).display === "none",
            // Input and submit sharing a line is the whole point of the collapse; compare
            // their vertical centres rather than tops, since their heights differ.
            oneLine:
              Math.abs(
                qInput.getBoundingClientRect().top + qInput.getBoundingClientRect().height / 2 -
                  (qSubmit.getBoundingClientRect().top + qSubmit.getBoundingClientRect().height / 2),
              ) < 4,
            // `oneLine` on its own is satisfiable by two degenerate layouts: a submit button
            // that stays at the 32px `.btn-sm` height beside 44px neighbours (centres still
            // line up), and an input shrunk to a few pixels so everything trivially fits.
            submitH: Math.round(qSubmit.getBoundingClientRect().height),
            inputW: Math.round(qInput.getBoundingClientRect().width),
          };
        }

        // ---- focus timer dial (Phase 7, plus the medical instrument pass) ----
        // Six things a stylesheet read cannot settle. (a) The sliding indicator is pure
        // arithmetic -- one cell wide, translated by whole multiples of itself -- and the
        // arithmetic is mirrored in RTL, so it is measured against the tab it is supposed to
        // be sitting behind rather than trusted. (b) The inner plate is sized by a percentage
        // chosen to clear the ring's stroke; get it wrong and the plate covers the
        // ring, which looks like the ring simply never renders. (c) The ring is only a
        // progress ring if its dashoffset actually differs from its dasharray. (d) The digits
        // now live inside the ring instead of their own box, so they have to fit the plate.
        // (e) The graduations sit on the annulus between the plate and the ring stroke, a band
        // about five viewBox units wide, and every one of those three radii is set in a
        // different file -- the plate as a CSS percentage, the ticks as SVG attributes computed
        // in the component, the stroke as a CSS width. (f) The monitor trace is a clipping
        // window sized as a percentage of a circular plate.
        const timerCard = document.getElementById("fx-timer");
        const dial = timerCard?.querySelector(".timer-dial");
        const tabs = timerCard ? [...timerCard.querySelectorAll(".timer-mode-tab")] : [];
        const indicator = timerCard?.querySelector(".timer-mode-indicator");
        if (dial && indicator && tabs.length === 3) {
          const dr = dial.getBoundingClientRect();
          const plate = dial.querySelector(".timer-dial-inner").getBoundingClientRect();
          const digits = dial.querySelector(".giant-timer-digits").getBoundingClientRect();
          const ring = dial.querySelector(".timer-ring").getBoundingClientRect();
          const prog = dial.querySelector(".timer-ring-progress");
          const ps = getComputedStyle(prog);
          const tabRects = tabs.map((el) => el.getBoundingClientRect());
          const ir = indicator.getBoundingClientRect();
          // The long graduations, read off the element rather than recomputed here: `r` comes
          // from the component's gauge() helper as an attribute and the radial length from the
          // stylesheet, so this is the only place the two meet. Both edges are converted out of
          // the 0..100 viewBox into the px the dial actually occupies.
          const major = dial.querySelector(".timer-gauge-major");
          const majorR = parseFloat(major.getAttribute("r"));
          const majorW = parseFloat(getComputedStyle(major).strokeWidth);
          const ecg = dial.querySelector(".timer-ecg").getBoundingClientRect();
          // Index 1 is selected in the fixture, so this is also the RTL flip test: without
          // `--tab-dir: -1` the pill lands on tab 3's cell in Arabic and the delta is a full
          // cell width out.
          const selected = tabRects[1];
          out.timer = {
            tabsOneRow: Math.max(...tabRects.map((r) => Math.abs(r.top - tabRects[0].top))) < 2,
            tabH: Math.round(Math.min(...tabRects.map((r) => r.height))),
            indOffset: Math.round(Math.abs(ir.left - selected.left)),
            indW: Math.round(ir.width),
            cellW: Math.round(selected.width),
            // The svg is inset:0 inside the dial, so any gap means the ring is not filling it.
            ringFills: Math.abs(ring.width - dr.width) < 1.5 && Math.abs(ring.height - dr.height) < 1.5,
            // 43.5% of the width is the stroke's inner edge: r=46 less half of a 5-unit
            // stroke, in a 0..100 viewBox.
            plateR: Math.round(plate.width / 2),
            ringInnerR: Math.round(dr.width * 0.435),
            tickInnerR: Math.round(((majorR - majorW / 2) / 100) * dr.width),
            tickOuterR: Math.round(((majorR + majorW / 2) / 100) * dr.width),
            dash: Math.round(parseFloat(ps.strokeDasharray) || 0),
            offset: Math.round(parseFloat(ps.strokeDashoffset) || 0),
            strokeW: +parseFloat(ps.strokeWidth).toFixed(2),
            digitsW: Math.round(digits.width),
            plateW: Math.round(plate.width),
            ecgW: Math.round(ecg.width),
          };

          // ---- fullscreen focus mode ----
          // Toggled here rather than kept as a second fixture: `fullscreen-focus-active` is
          // `position: fixed; inset: 0`, so a permanent copy would take the page over and
          // every other probe with it. This is the last thing measured, and the class comes
          // straight back off. Fullscreen resizes the dial and the digits independently
          // (`min(21rem, 36vh)` against a separate clamp), so "it fits at 19rem" says
          // nothing about whether it fits here.
          const fsHost = timerCard.querySelector(".focus-workspace-container");
          // The component does not mount the setup sidebar in fullscreen -- it is inside a
          // `{!focusMode && ...}`. The fixture holds both states at once so the non-fullscreen
          // probes have a sidebar to measure, so this is where the two are reconciled: leaving
          // it in would put a fourth item in a three-column grid and wrap it under the art.
          const fsSidebar = timerCard.querySelector(".focus-sidebar-card");
          fsSidebar.style.display = "none";
          fsHost.classList.add("fullscreen-focus-active");
          const fsDial = dial.getBoundingClientRect();
          const fsPlate = dial.querySelector(".timer-dial-inner").getBoundingClientRect();
          const fsDigits = dial.querySelector(".giant-timer-digits").getBoundingClientRect();
          // The illustrated panels. They are the widest thing on the page when they are on, and
          // they are tilted and floating, so they are the likeliest source of a horizontal
          // scrollbar in a mode that must not have one. Measured on both edges: in RTL an
          // over-wide element hangs off the left and a right-edge test reads as a pass.
          const art = [...timerCard.querySelectorAll(".focus-art-panel")].map((el) => {
            const r = el.getBoundingClientRect();
            return {
              shown: getComputedStyle(el).display !== "none",
              w: Math.round(r.width),
              spill: Math.max(Math.round(r.right) - vw, -Math.round(r.left)),
            };
          });
          fsHost.classList.remove("fullscreen-focus-active");
          fsSidebar.style.display = "";
          out.timer.fs = {
            plateR: Math.round(fsPlate.width / 2),
            ringInnerR: Math.round(fsDial.width * 0.435),
            digitsW: Math.round(fsDigits.width),
            plateW: Math.round(fsPlate.width),
            art,
          };
        }

        return out;
      },
      { SECTIONS, TAP, DECO_SELECTORS },
    );

    const tag = `${mood} ${w}x${h}${mobile ? " coarse" : ""}${dir === "rtl" ? " rtl" : ""}`;
    const navBad = res.nav ? res.nav.overlap > 0 || res.nav.wasted > 0 : false;
    // Below the breakpoint every listed card must drop to the xs shadow and a sub-2px
    // border. Nothing is asserted above it: `@media (max-width: 768px)` structurally
    // cannot apply at 1440px, and several of these cards already ship an xs shadow at
    // full size, so "desktop must not look thinned" is not expressible as one value.
    const decoBad = w <= 768 ? (res.deco ?? []).filter((d) => !d.xs || d.bw > 1.5) : [];
    if (!res.deco?.length) throw new Error("decoration probe matched no cards -- fixture drifted");
    // 28.8px is the 1.8rem clamp floor. The plan proposed 1.6rem, which would have made
    // 360px smaller than it already was -- the opposite of "never looks squeezed" -- so the
    // floor stayed and only the ramp got faster. Asserted here so it cannot drift back down.
    if (!res.hdr) throw new Error("page-header probe found nothing -- fixture drifted");
    const hdrBad = [];
    if (!res.hdr.card) hdrBad.push("header is not rendering as a bordered, padded card");
    if (res.hdr.h1 < 28.8) hdrBad.push(`h1 is ${res.hdr.h1}px, below the 28.8px floor`);
    if (res.hdr.badgeW < res.hdr.badgeH) hdrBad.push(`icon badge squeezed to ${res.hdr.badgeW}x${res.hdr.badgeH}`);
    if (w <= 768 && !res.hdr.xs) hdrBad.push("mobile header shadow did not step down to xs");
    if (w > 768 && !res.hdr.base) hdrBad.push("desktop header shadow is not the full-size one");
    if (!res.task) throw new Error("tasks notebook probe found nothing -- fixture drifted");
    const taskBad = [];
    if (w <= 768) {
      if (res.task.tilted) taskBad.push("a task card still carries the pinboard tilt");
      if (res.task.tape) taskBad.push("the sticky-note tape strip is still rendered");
      if (res.task.minH > 0) taskBad.push(`card min-height is still ${res.task.minH}px`);
      if (res.task.bodyMinH > 0) taskBad.push(`card body min-height is still ${res.task.bodyMinH}px`);
      if (res.task.manageOff !== "none") taskBad.push("manage row is visible with data-manage=off");
      if (res.task.manageOn === "none") taskBad.push("manage row is hidden with data-manage=on");
      if (!res.task.optsHidden) taskBad.push("quick-add selects are visible with data-options=off");
      if (!res.task.oneLine) taskBad.push("quick-add input and submit are not on the same line");
      if (res.task.submitH < 44) taskBad.push(`quick-add submit is ${res.task.submitH}px tall, under the 44px row`);
      // The input gets `viewport - 248` (see the 359px block in components.css). The binding
      // case is 360px at 112px; 320px only clears this because the decorative pen drops out.
      if (res.task.inputW < 110) taskBad.push(`quick-add input squeezed to ${res.task.inputW}px`);
    } else {
      // Above the breakpoint every one of those is the opposite: the pinboard is the design.
      if (!res.task.tilted) taskBad.push("desktop lost the pinboard tilt");
      if (!res.task.tape) taskBad.push("desktop lost the sticky-note tape");
      if (res.task.manageOff === "none") taskBad.push("desktop hid the manage row");
      if (res.task.optsHidden) taskBad.push("desktop hid the quick-add selects");
    }
    if (!res.timer) throw new Error("focus timer probe found nothing -- fixture drifted");
    const timerBad = [];
    if (!res.timer.tabsOneRow) timerBad.push("the three mode tabs are not on one row");
    if (res.timer.tabH < 44) timerBad.push(`mode tab is ${res.timer.tabH}px tall, under the 44px target`);
    if (Math.abs(res.timer.indW - res.timer.cellW) > 1)
      timerBad.push(`indicator is ${res.timer.indW}px against a ${res.timer.cellW}px cell`);
    if (res.timer.indOffset > 1)
      timerBad.push(`indicator sits ${res.timer.indOffset}px off the selected tab${dir === "rtl" ? " (RTL flip)" : ""}`);
    if (!res.timer.ringFills) timerBad.push("the ring svg is not filling the dial");
    if (res.timer.strokeW <= 0) timerBad.push("the ring has no stroke width");
    if (res.timer.plateR > res.timer.ringInnerR)
      timerBad.push(`inner plate radius ${res.timer.plateR}px covers the ring, whose inner edge is at ${res.timer.ringInnerR}px`);
    // A ring wired to nothing renders as a full circle (offset 0) or an empty one
    // (offset === dash). The fixture is a quarter elapsed, so it must be strictly between.
    if (!(res.timer.offset > 0 && res.timer.offset < res.timer.dash))
      timerBad.push(`dashoffset ${res.timer.offset} is not a partial arc of ${res.timer.dash}`);
    if (res.timer.digitsW > res.timer.plateW)
      timerBad.push(`digits are ${res.timer.digitsW}px wide inside a ${res.timer.plateW}px plate`);
    // The graduations have to land in the band between the plate's rim and the ring's stroke.
    // Both ends can go wrong independently: the plate is a CSS percentage of the dial, the
    // ticks are attributes computed in the component, and the ring's stroke width is CSS.
    if (res.timer.plateR > res.timer.tickInnerR)
      timerBad.push(`plate radius ${res.timer.plateR}px covers the graduations, which reach in to ${res.timer.tickInnerR}px`);
    if (res.timer.tickOuterR > res.timer.ringInnerR)
      timerBad.push(`graduations reach out to ${res.timer.tickOuterR}px, past the ring's inner edge at ${res.timer.ringInnerR}px`);
    if (!(res.timer.ecgW > 0 && res.timer.ecgW <= res.timer.plateW))
      timerBad.push(`the trace window is ${res.timer.ecgW}px inside a ${res.timer.plateW}px plate`);
    if (res.timer.fs.plateR > res.timer.fs.ringInnerR)
      timerBad.push(`fullscreen plate radius ${res.timer.fs.plateR}px covers the ring at ${res.timer.fs.ringInnerR}px`);
    if (res.timer.fs.digitsW > res.timer.fs.plateW)
      timerBad.push(`fullscreen digits are ${res.timer.fs.digitsW}px inside a ${res.timer.fs.plateW}px plate`);
    // The illustrated panels: on above 1180px, off below it, and never over an edge. Both
    // halves matter -- "always hidden" would pass a right-edge spill test just as well as a
    // correct layout does, and a panel that leaks in at 390px would push the dial off-centre.
    if (res.timer.fs.art.length !== 2)
      timerBad.push(`expected two illustrated panels in fullscreen, found ${res.timer.fs.art.length}`);
    for (const [i, a] of res.timer.fs.art.entries()) {
      const wantShown = w >= 1180;
      if (a.shown !== wantShown)
        timerBad.push(`art panel ${i + 1} is ${a.shown ? "shown" : "hidden"} at ${w}px wide`);
      if (a.shown && a.spill > 1) timerBad.push(`art panel ${i + 1} spills ${a.spill}px past the viewport`);
      if (a.shown && a.w < 200) timerBad.push(`art panel ${i + 1} is only ${a.w}px wide -- the drawings are meant to be big`);
    }
    const bad =
      res.doc > 1 ||
      res.clipped.length ||
      res.tiny.length ||
      navBad ||
      decoBad.length ||
      hdrBad.length ||
      taskBad.length ||
      timerBad.length;
    if (bad) fail++;
    console.log(
      `\n[${tag}] doc=+${res.doc} clipped=${res.clipped.length} tiny=${res.tiny.length}` +
        (res.nav ? ` nav=${res.nav.shown ? `${res.nav.navH}px` : "hidden"} padB=${res.nav.padB}` : "") +
        ` hdr=h1:${res.hdr.h1}px/${res.hdr.xs ? "xs" : res.hdr.base ? "base" : "?"}` +
        ` task=${res.task.tilted ? "tilt" : "flat"}/${res.task.tape ? "tape" : "notape"}/minH${res.task.minH}` +
        ` timer=pill${res.timer.indOffset}px/plate${res.timer.plateR}<=${res.timer.tickInnerR}<${res.timer.tickOuterR}<=${res.timer.ringInnerR}/digits${res.timer.digitsW}` +
        ` fs=${res.timer.fs.plateR}<=${res.timer.fs.ringInnerR}/digits${res.timer.fs.digitsW}` +
        ` art=${res.timer.fs.art.map((a) => (a.shown ? `${a.w}px` : "off")).join("+")}`,
    );
    for (const c of res.clipped)
      console.log(
        `    ${c.spill !== undefined ? `SPILL +${c.spill}px w=${c.w}` : `CLIP ${c.clientW}<-${c.scrollW} (hidden ${c.hidden})`}  ${c.sel}   [${c.label}]`,
      );
    for (const t of res.tiny) console.log(`    TINY  ${t.sel} ${t.w}x${t.h}`);
    if (res.nav?.overlap > 0) console.log(`    NAV-OVERLAP  bar covers last ${res.nav.overlap}px of the page`);
    if (res.nav?.wasted > 0) console.log(`    NAV-WASTED   ${res.nav.wasted}px dead strip with no bar rendered`);
    for (const d of decoBad)
      console.log(
        `    DECO  ${d.sel} border=${d.bw}px xsShadow=${d.xs} -- expected xs shadow and border <=1.5px`,
      );
    for (const m of hdrBad) console.log(`    HDR   ${m}`);
    for (const m of taskBad) console.log(`    TASK  ${m}`);
    for (const m of timerBad) console.log(`    TIMER ${m}`);
    for (const t of res.viaLabel)
      console.log(`    ok(label) ${t.sel} ${t.w}x${t.h} -> clickable label ${t.lw}x${t.lh}`);
    await ctx.close();
  }
}

/* ================= desktop sidebar vertical fill =================
 * Its own sweep rather than more entries in RUNS, because this defect's trigger is viewport
 * HEIGHT, and its second half is page LENGTH -- neither is something the width-driven runs
 * above vary. `.app-frame` only sets `min-height: 100vh`, so the sidebar had no height of its
 * own and took whatever the frame was:
 *   short page  -> the frame is the viewport, and every pixel it has over the logo + nav +
 *                  footer stack was leftover that `justify-content: space-between` split into
 *                  visible gaps above and below the nav.
 *   long page    -> the frame is the taller column, thousands of pixels on /analytics, so the
 *                  sidebar stretched to the whole document, the nav grew into all of it, and
 *                  the footer sat at the bottom of the page instead of the screen.
 * Both are measured, at heights either side of the stack's own height (~1050px here) so the
 * nav is required to grow in some runs and to shrink and scroll internally in others.
 *
 * One mood only: nothing in tokens.css makes sidebar geometry mood-dependent (the mood picks
 * --sidebar-background, a colour). Both directions, because the gaps are block-axis and a
 * physical-property slip there would show up as an RTL-only asymmetry. */
const SIDEBAR_RUNS = [];
for (const dir of ["ltr", "rtl"]) {
  for (const h of [700, 900, 1080, 1440, 2160]) SIDEBAR_RUNS.push([1440, h, dir]);
}
// 769px is the first width at which the sidebar is not `display: none`.
SIDEBAR_RUNS.push([769, 1080, "ltr"]);

for (const [w, h, dir] of SIDEBAR_RUNS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`file:///${process.cwd().replace(/\\/g, "/")}/${DIR}/css-geometry.html`);
  await page.evaluate((d) => (document.documentElement.dir = d), dir);
  await page.addStyleTag({
    content: "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }",
  });
  await page.waitForTimeout(80);

  const sb = await page.evaluate(() => {
    const frame = document.getElementById("fx-sidebar");
    const bar = frame?.querySelector(".app-sidebar");
    if (!bar) return null;
    const bs = getComputedStyle(bar);
    if (bs.display === "none") return { shown: false };
    const mark = frame.querySelector(".app-wordmark");
    const nav = frame.querySelector(".sidebar-nav");
    const foot = frame.querySelector(".app-sidebar-footer");
    const body = frame.querySelector(".app-content");
    const r = (el) => el.getBoundingClientRect();
    const groups = [...nav.querySelectorAll(".sidebar-group")];
    const padT = parseFloat(bs.paddingTop);
    const padB = parseFloat(bs.paddingBottom);
    const vh = window.innerHeight;
    // The fixture stacks these shells, so this frame starts several thousand pixels down the
    // document. Every state below is measured with the frame scrolled to the top of the
    // viewport, which is the only position from which "is the footer on screen" means anything
    // -- and, for a sticky sidebar, the only one that exercises the stickiness at all.
    const frameTop = () => Math.round(frame.getBoundingClientRect().top + window.scrollY);
    // Everything an assertion needs about one layout state. The four gaps are the ones the bug
    // lived in: above the wordmark, wordmark-to-nav, nav-to-footer, footer-to-bottom.
    const shot = () => ({
      gaps: [
        Math.round(r(mark).top - (r(bar).top + padT)),
        Math.round(r(nav).top - r(mark).bottom),
        Math.round(r(foot).top - r(nav).bottom),
        Math.round(r(bar).bottom - padB - r(foot).bottom),
      ],
      barH: Math.round(r(bar).height),
      navH: Math.round(r(nav).height),
      navScrollH: nav.scrollHeight,
      navClientH: nav.clientHeight,
      // How far the footer's bottom edge is past the bottom of the screen. This is the number
      // the /analytics report was about: the footer was thousands of pixels down the document,
      // so what was on screen was nav followed by dead space.
      footBelowFold: Math.round(r(foot).bottom - vh),
    });
    window.scrollTo(0, frameTop());
    const base = shot();

    /* "Regardless of which page is active." Every sidebar link in turn, nav and footer both,
       rather than one sample: `[aria-current="page"]` swaps in a border colour and a box
       shadow over a base rule that already reserves 2px of transparent border, so it should
       cost nothing in the box model -- but a future active style with its own padding would
       change the nav's content height and move the whole stack. */
    const links = [...bar.querySelectorAll(".sidebar-nav a, .app-sidebar-footer a")];
    const wasCurrent = links.map((el) => el.getAttribute("aria-current"));
    let activeDrift = 0;
    let activeWorst = null;
    for (const [i, el] of links.entries()) {
      links.forEach((o) => o.removeAttribute("aria-current"));
      el.setAttribute("aria-current", "page");
      const g = shot().gaps;
      const drift = Math.max(...g.map((v, j) => Math.abs(v - base.gaps[j])));
      if (drift > activeDrift) {
        activeDrift = drift;
        activeWorst = `${el.textContent.trim()} (link ${i + 1}/${links.length}) -> ${g.join("/")}`;
      }
    }
    links.forEach((el, i) =>
      wasCurrent[i] === null ? el.removeAttribute("aria-current") : el.setAttribute("aria-current", wasCurrent[i]),
    );

    /* The /analytics case: same shell, page body grown past the viewport. Measured at the top
       and again partway down, because a sidebar that is merely tall enough looks correct at
       scroll 0 and comes apart as soon as the page moves -- the footer has to stay on screen,
       not just exist. */
    const wasBody = body.innerHTML;
    body.innerHTML = '<div style="height: 5000px">Long page body</div>';
    window.scrollTo(0, frameTop());
    const tall = shot();
    window.scrollTo(0, frameTop() + 2000);
    const scrolled = shot();
    window.scrollTo(0, 0);
    body.innerHTML = wasBody;

    return {
      shown: true,
      vh,
      // The sidebar's own flex gap is the only spacing that belongs between the three
      // children, so it is read off the element rather than hard-coded here: anything more
      // than this between them is the leftover space leaking through.
      gap: Math.round(parseFloat(bs.rowGap)),
      links: links.length,
      activeDrift,
      activeWorst,
      base,
      tall,
      scrolled,
      navOverflowY: getComputedStyle(nav).overflowY,
      // Uniform by construction (one flex gap), so an outlier means space is being
      // distributed inside the nav too.
      groupGaps: groups.slice(1).map((g, i) => Math.round(r(g).top - r(groups[i]).bottom)),
      // `.sidebar-rule` was declared twice with different heights and margins. A probe cannot
      // see two rules, but it can pin the values the merge settles on, so a re-split that
      // changes them fails here.
      rules: [...nav.querySelectorAll(".sidebar-rule")].map((el) => {
        const s = getComputedStyle(el);
        return [
          +parseFloat(s.height).toFixed(1),
          +parseFloat(s.marginTop).toFixed(1),
          +parseFloat(s.marginBottom).toFixed(1),
          s.backgroundColor,
        ].join("/");
      }),
    };
  });

  const tag = `sidebar ${w}x${h}${dir === "rtl" ? " rtl" : ""}`;
  if (!sb) throw new Error("sidebar probe found nothing -- fixture drifted");
  if (!sb.shown) throw new Error(`sidebar is display:none at ${w}px wide -- above the 768px breakpoint`);
  const sbBad = [];
  /* The same four gaps have to hold in all three states, so the assertions are written once and
     run over each: a short page, an /analytics-length one, and that same long page scrolled. */
  for (const [state, s] of [["short page", sb.base], ["long page", sb.tall], ["long page scrolled", sb.scrolled]]) {
    const [g0, g1, g2, g3] = s.gaps;
    if (g0 > 1) sbBad.push(`[${state}] ${g0}px of stray space above the wordmark`);
    if (Math.abs(g1 - sb.gap) > 1)
      sbBad.push(`[${state}] ${g1}px between wordmark and nav, expected the ${sb.gap}px flex gap`);
    if (Math.abs(g2 - sb.gap) > 1)
      sbBad.push(`[${state}] ${g2}px between nav and footer, expected the ${sb.gap}px flex gap`);
    if (Math.abs(g3) > 1) sbBad.push(`[${state}] footer is ${g3}px off the bottom of the sidebar`);
    // The sidebar is one viewport tall in every state. Taller means it is tracking the document
    // again, which is what put the footer out of reach on /analytics; shorter would leave the
    // rail short of the fold.
    if (Math.abs(s.barH - sb.vh) > 1)
      sbBad.push(`[${state}] sidebar is ${s.barH}px tall in a ${sb.vh}px viewport`);
    // ...and the footer is on screen, not somewhere down the page.
    if (s.footBelowFold > 1) sbBad.push(`[${state}] footer sits ${s.footBelowFold}px below the fold`);
    // Whichever way the nav has to give: it scrolls itself rather than shoving the footer.
    if (s.navScrollH > s.navClientH + 1 && !["auto", "scroll"].includes(sb.navOverflowY))
      sbBad.push(`[${state}] nav overflows by ${s.navScrollH - s.navClientH}px with overflow-y: ${sb.navOverflowY}`);
    if (s.navClientH < 40) sbBad.push(`[${state}] nav collapsed to ${s.navClientH}px`);
  }
  const gapSpread = sb.groupGaps.length ? Math.max(...sb.groupGaps) - Math.min(...sb.groupGaps) : 0;
  if (gapSpread > 1) sbBad.push(`nav group gaps are uneven: ${sb.groupGaps.join(", ")}px`);
  if (sb.rules.length !== 3) sbBad.push(`expected 3 group dividers, found ${sb.rules.length}`);
  if (new Set(sb.rules).size > 1) sbBad.push(`dividers are styled inconsistently: ${[...new Set(sb.rules)].join(" vs ")}`);
  const [rh, rmt, rmb] = (sb.rules[0] ?? "").split("/").map(Number);
  if (sb.rules.length && !(rh === 2 && rmt === 8 && rmb === 8))
    sbBad.push(`divider is ${rh}px tall with ${rmt}/${rmb}px margins, expected 2px and 8/8`);
  // 12 nav items in four groups, plus Notifications and Settings in the footer.
  if (sb.links !== 14) sbBad.push(`expected 14 sidebar links, found ${sb.links} -- fixture drifted`);
  if (sb.activeDrift > 1) sbBad.push(`active page moves the stack by ${sb.activeDrift}px: ${sb.activeWorst}`);
  if (sbBad.length) fail++;
  console.log(
    `\n[${tag}] bar=${sb.base.barH}px nav=${sb.base.navH}px(content ${sb.base.navScrollH}px)` +
      ` gaps=${sb.base.gaps.join("/")} (flex gap ${sb.gap}) groups=${sb.groupGaps.join(",")}` +
      ` | long-page bar=${sb.tall.barH}px nav=${sb.tall.navH}px gaps=${sb.tall.gaps.join("/")}` +
      ` foot-below-fold=${sb.tall.footBelowFold}px, scrolled ${sb.scrolled.footBelowFold}px` +
      ` | active-drift=${sb.activeDrift}px over ${sb.links} links`,
  );
  for (const m of sbBad) console.log(`    SIDEBAR ${m}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${fail === 0 ? "PASS" : `FAIL: ${fail} combo(s) with findings`}`);
process.exit(fail === 0 ? 0 : 1);