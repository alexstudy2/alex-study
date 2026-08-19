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
  ["fx-tabs", "/tasks header + chips", [".notebook-top-header", ".notebook-filter-tabs", ".header-branding", ".header-actions", ".task-vitals-strip", ".task-vitals", ".task-vital", ".subjects-ribbon", ".subjects-scroll"]],
  ["fx-pill", "page-header nav pill", [".page-header-container", ".page-header-main", ".page-header-text", ".page-header-actions", ".page-header"]],
  ["fx-orbit", "score-orbit", [".score-orbit"]],
  ["fx-lobbyform", "/lobbies/create form", [".lobby-form", ".lobby-form label", ".form-grid"]],
  // The two heatmaps and the calendar are deliberately absent from this list: both live inside an
  // `overflow-x: auto` wrapper and are *meant* to be wider than it, so their bounding rects would
  // be reported as spills. The wrappers are listed instead, which is where a real clip would show.
  ["fx-analytics", "/analytics workspace", [".analytics-workspace", ".analytics-sidebar", ".analytics-main", ".analytics-toolbar", ".analytics-toolbar-controls", ".analytics-summary", ".analytics-panel", ".analytics-panel-heading", ".analytics-consistency", ".analytics-calendar-wrap", ".analytics-heat-legend", ".analytics-streaks", ".analytics-streak", ".analytics-hourmap-wrap", ".analytics-split", ".analytics-course-layout", ".analytics-course-detail", ".analytics-sort", ".analytics-course-grid", ".analytics-course-grid article", ".analytics-legend", ".analytics-ai-panel", ".analytics-ai-heading", ".analytics-signal-grid", ".analytics-signal-grid article"]],
  ["fx-lobbystudio", "/lobbies/:id studio", [".lobby-studio-grid", ".lobby-primary-column"]],
  ["fx-taskrow", "tasks notebook card", [".master-notebook-card", ".notebook-quick-add-line", ".notebook-tasks-surface", ".notebook-task-list", ".notebook-task-row", ".task-row-left", ".task-row-body", ".task-row-title-bar", ".task-row-badges", ".task-meta-pill", ".notebook-empty-view", ".empty-description", ".empty-actions"]],
  // `.empty-scene` is deliberately not in this list: the "All clear" stamp is absolutely
  // positioned off its corner on purpose, which reads as an overflow to the scan below. Its
  // geometry is checked directly in the sticky probe instead, against the card it sits in.
  ["fx-stickyadd", "dashboard quick-add + empty scene", [".today-tasks-sticky-card", ".sticky-tasks-header", ".sticky-inline-add-form", ".sticky-input-row", ".sticky-meta-row", ".sticky-field", ".sticky-tasks-list", ".ui-empty-state", ".ui-empty-description", ".empty-actions"]],
  // The page the card above lives on. Listed separately because the defect was never in the card:
  // `.dashboard-layout-grid` is what set the width, and only a fixture with both columns and both
  // full headers in it can show that.
  ["fx-dashboard", "/dashboard two-column page", [".dashboard-hero-card", ".dashboard-hero-content", ".dashboard-hero-actions", ".dashboard-layout-grid", ".dashboard-left-col", ".dashboard-right-col", ".today-tasks-sticky-card", ".sticky-tasks-header", ".sticky-tasks-list", ".dashboard-memo-card", ".dashboard-card", ".dashboard-card-header", ".study-rhythm-body", ".dashboard-progress", ".dashboard-goals-list", ".goal-item-card"]],
  // The phone setup window. `.focus-sidebar-card` is `position: fixed` here, so its own rect is the
  // viewport by construction and the interesting geometry is inside it -- which the setup probe
  // below measures directly. What the sweep is for is the fields: a window is not an excuse for a
  // stepper row that cannot shrink.
  ["fx-focussetup", "/focus setup window", [".focus-setup-body", ".focus-field", ".focus-assign-options", ".focus-assign-option", ".focus-assign-copy", ".focus-durations", ".focus-duration-row", ".focus-stepper", ".focus-setup-footer", ".focus-setup-hint"]],
  ["fx-timer", "/focus timer card", [".focus-main-grid", ".doodle-timer-card", ".timer-chart-head", ".timer-mode-segmented-tabs", ".timer-mode-tab", ".timer-status-row", ".timer-dial", ".timer-dial-inner", ".giant-timer-digits", ".timer-ecg", ".timer-vitals", ".timer-action-buttons", ".doodle-distraction-btn", ".focus-sidebar-card"]],
  ["fx-sidebar", "desktop sidebar", [".app-sidebar", ".sidebar-nav", ".sidebar-group", ".app-sidebar-footer", ".study-mood-sidebar-btn"]],
  // `.plan-note-watermark` and `.plan-card-watermark` are absolutely positioned off their note's
  // corner on purpose -- the same reason `.empty-scene` is absent above -- so the notes are listed
  // and the watermarks are not. `.plan-day-grid` and `.plan-shelf-grid` are auto-fill grids and the
  // whole point of listing them is that they fall to one column rather than forcing 16rem tracks.
  ["fx-planboard", "/plan-forum board + forum + calendar switch", [".plan-board", ".plan-board-head", ".plan-board-period", ".plan-board-actions", ".plan-readonly-banner", ".plan-day-grid", ".plan-day-note", ".plan-day-head", ".plan-note-tasks", ".plan-note-task", ".plan-note-text", ".plan-note-add-btn", ".plan-note-form", ".plan-note-form-actions", ".plan-forum-layout", ".plan-new-pad", ".plan-period-row", ".plan-shelf", ".plan-shelf-head", ".plan-shelf-grid", ".plan-card", ".plan-card-head", ".plan-card-meta", ".plan-card-actions", ".plan-shelf-empty", ".plan-forum-footnote", ".calendar-source-bar", ".calendar-source-tabs", ".calendar-copy-box"]],
  // The board's notes are the forum's, so `.plan-day-*` is listed again here rather than trusted
  // from above: what is new is the load chip in the head and the checkbox in the row, and both
  // land inside those two boxes. `.exam-upload-thumb-clear` is absent for the same reason the
  // watermarks are -- it is positioned onto the thumbnail's corner on purpose.
  ["fx-examboard", "AI Exam Plan wizard + proposal board", [".exam-plan-share", ".exam-view-tabs", ".exam-board", ".plan-day-grid", ".plan-day-note", ".plan-day-head", ".plan-note-tasks", ".plan-note-task", ".plan-note-text", ".wizard-container", ".wizard-steps", ".wizard-step-content", ".wizard-step-actions", ".exam-upload", ".exam-upload-row", ".exam-upload-thumb", ".exam-topic-composer", ".exam-topic-toolbar", ".exam-topic-toolbar-actions", ".exam-topic-paste", ".exam-topic-paste-actions", ".exam-topic-list", ".exam-topic-card", ".exam-topic-main", ".exam-topic-fields", ".exam-strategy-grid", ".exam-strategy-card", ".exam-rest-days", ".exam-rest-day-row", ".exam-review-card", ".exam-review-list", ".exam-plan-create-layout", ".exam-plan-form-panel", ".exam-plan-recent-panel", ".exam-plan-list", ".exam-plan-card", ".exam-plan-card > div", ".exam-capacity-label", ".exam-capacity-range"]],
  // The page that frames the two above, which nothing in `fx-examboard` reaches. The controls
  // themselves are deliberately not listed: a text input reports a `scrollWidth` wider than its
  // client box whenever its *value* overflows, which this fixture's unbreakable strings guarantee,
  // and that is internal scrolling rather than a layout spill. Every one of them is `width: 100%`
  // inside a grid label, so a real blowout shows on the label or the `.form-grid` around it, and the
  // things a rectangle cannot see -- the border, and the gap between caption and control -- are
  // measured by the `out.detail` probe below instead.
  ["fx-examdetail", "/exam-plans/:id proposal page", [".exam-plan-detail-shell", ".exam-plan-detail-header", ".page-header-text", ".exam-plan-share", ".exam-plan-attribution", ".exam-plan-fact", ".exam-plan-editor", ".exam-plan-meta", ".exam-plan-meta .form-grid", ".exam-plan-meta label", ".exam-plan-items", ".exam-plan-item-list", ".exam-plan-item", ".exam-plan-item-heading", ".exam-plan-item .form-grid", ".exam-plan-item label", ".plan-item-select", ".exam-plan-conversion", ".task-conversion-confirmation", ".exam-plan-feedback", ".exam-plan-reject-zone"]],
];

const TAP = [
  ".drag-grip-btn",
  ".task-checkbox-btn",
  ".task-complete-btn",
  ".task-subtasks-toggle",
  ".task-action-icon-btn",
  ".quick-add-options-toggle",
  ".notebook-manage-toggle",
  ".sticky-select",
  ".sticky-cancel-btn",
  ".empty-actions .btn",
  ".subject-chip",
  ".timer-mode-tab",
  ".analytics-toolbar select",
  ".analytics-sort button",
  ".calendar-event",
  ".plan-note-add-btn",
  ".plan-note-remove",
  ".calendar-copy-box button",
  ".calendar-source-tabs button",
  ".exam-view-tabs button",
  ".exam-note-check",
  ".exam-topic-remove",
  ".exam-upload-btn",
  ".text-button",
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

/* One run only ever sees one mood, so "the chart ink is a different colour in cosmic" is not a
   within-run assertion -- it is a comparison between two runs. Filled during the sweep and checked
   after it, because that comparison is the direct regression test for the fault this pass removed:
   six hardcoded hexes painting #263D5B ink onto the #182234 card of the one dark mood. A palette
   that is mood-blind again would still pass every other check in this file. */
const CHART_INK = {};

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
        const out = { vw, doc: document.documentElement.scrollWidth - vw, clipped: [], tiny: [], spill: [], viaLabel: [] };
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

        // ---- label spilling out of its own button ----
        // Every .btn is `white-space: nowrap`, so a button narrower than its label does not clip
        // or wrap -- the text simply paints outside the border, centred, hanging off both sides.
        // The section sweep above cannot see it: the row that holds the buttons is
        // `flex-wrap: wrap` and reports no overflow of its own, and a centred spill of a few dozen
        // px stays inside the viewport, so both existing tests pass while the control is visibly
        // broken. Measured against the padding box, because padding-inline is the gap the design
        // asks for between the border and the text -- a label touching the border is already wrong.
        // Document-wide rather than timer-only: nowrap is on .btn, so this is every button's bug.
        for (const el of document.querySelectorAll(".btn")) {
          const st = getComputedStyle(el);
          if (st.display === "none" || el.clientWidth === 0) continue;
          const inner = el.clientWidth - parseFloat(st.paddingInlineStart) - parseFloat(st.paddingInlineEnd);
          let content = 0;
          for (const child of el.childNodes) {
            if (child.nodeType === 3) {
              if (!child.textContent.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(child);
              content += range.getBoundingClientRect().width;
            } else if (child.nodeType === 1) {
              content += child.getBoundingClientRect().width;
            }
          }
          const gap = parseFloat(st.columnGap) || 0;
          const parts = [...el.childNodes].filter(
            (c) => (c.nodeType === 3 && c.textContent.trim()) || c.nodeType === 1,
          ).length;
          content += Math.max(0, parts - 1) * gap;
          const over = Math.round(content - inner);
          if (over > 1) {
            out.spill.push({
              text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 28),
              cls: el.className.replace(/\s+/g, "."),
              over,
              inner: Math.round(inner),
            });
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
          const triage = [...document.querySelectorAll("#fx-triage .task-priority-pill")];
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

            // ---- the two systems that used to render as nothing at all ----
            // `--note-color` named tokens (--amber, --teal) that were never defined, so it was
            // guaranteed-invalid, so `background: color-mix(... var(--note-color) ...)` was
            // invalid at computed-value time and fell all the way back to transparent: every
            // note had no paper and the tape strip was an empty outline. And `.priority-*` was
            // rendered on every pill with no rule anywhere matching it, so all four levels drew
            // identically. Neither failure is visible in a stylesheet read, and neither is
            // visible to anyone who never saw the page work -- so both are measured. Two
            // courses must give two non-transparent papers, four levels four different fills.
            papers: cards.map((c) => getComputedStyle(c).backgroundColor),
            tags: [...notebook.querySelectorAll(".task-subject-tag")].map(
              (t) => getComputedStyle(t).backgroundColor,
            ),
            spines: cards.map((c) => getComputedStyle(c, "::after").backgroundColor),
            pills: triage.map((p) => getComputedStyle(p).backgroundColor),
            // Overdue moves the border ink and nothing else; one card of each state.
            ink: [collapsed, expandedCard].map((c) => getComputedStyle(c).borderTopColor),
            // A watermark scaled to nothing is indistinguishable from no drawing at all, and it
            // is behind the text where that is easy not to notice.
            markW: Math.round(collapsed.querySelector(".task-note-watermark").getBoundingClientRect().width),
            barW: Math.round(collapsed.querySelector(".task-subtask-bar").getBoundingClientRect().width),
          };
        }

        // ---- tasks page vitals strip ----
        // Four readouts and a trace. The strip is the one new thing on the page that is pure
        // width -- four labelled numbers in a row do not fit a phone -- so what is checked is
        // that it regrouped rather than overflowed, and that the four boxes still line up.
        const vitals = document.querySelector(".task-vitals-strip");
        const vItems = vitals ? [...vitals.querySelectorAll(".task-vital")] : [];
        if (vitals && vItems.length === 4) {
          const vecg = vitals.querySelector(".task-vitals-ecg");
          const rects = vItems.map((i) => i.getBoundingClientRect());
          out.vitals = {
            // A label that wraps to two lines shows up from here as four different heights.
            sameH: rects.every((r) => Math.abs(r.height - rects[0].height) < 1),
            rows: new Set(rects.map((r) => Math.round(r.top))).size,
            ecgShown: getComputedStyle(vecg).display !== "none",
            hidden: Math.round(vitals.scrollWidth - vitals.clientWidth),
          };
        }

        // ---- dashboard quick-add + "nothing due today" ----
        const sticky = document.getElementById("fx-stickyadd");
        const scene = sticky?.querySelector(".empty-scene");
        if (sticky && scene) {
          const box = sticky.querySelector(".ui-empty-state").getBoundingClientRect();
          const stamp = scene.querySelector(".empty-stamp").getBoundingClientRect();
          const fields = [...sticky.querySelectorAll(".sticky-field")];
          const sels = [...sticky.querySelectorAll(".sticky-select")];
          const actions = [...sticky.querySelectorAll(".empty-actions .btn")];
          out.sticky = {
            // The whole point of the :has() override. The shared EmptyState clamps
            // `.ui-empty-icon svg` to 26px inside a 52px circle, which is right for the single
            // lucide glyph it was built for and would crush a drawn scene to a coin. Anything
            // wider than 26 proves the override won.
            glyphW: Math.round(scene.querySelector(".empty-scene-glyph").getBoundingClientRect().width),
            sceneW: Math.round(scene.getBoundingClientRect().width),
            // The stamp hangs off the scene's corner on purpose. Off the card is a clip.
            stampSpill: Math.round(Math.max(box.left - stamp.left, stamp.right - box.right)),
            selH: Math.min(...sels.map((s) => Math.round(s.getBoundingClientRect().height))),
            rows: new Set(fields.map((f) => Math.round(f.getBoundingClientRect().top))).size,
            actionH: Math.min(...actions.map((a) => Math.round(a.getBoundingClientRect().height))),
            // Both cues are fed by the same [data-color] / [data-priority] rules as the cards,
            // so a transparent one here means the shared resolution broke for everyone.
            swatch: getComputedStyle(sticky.querySelector(".sticky-course-swatch")).backgroundColor,
            spine: getComputedStyle(sticky.querySelector(".sticky-priority-spine")).backgroundColor,
          };
        }

        // ---- hand-drawn chrome ----
        /* Everything here is the difference between "drawn" and "a default form", and not one of
           them is a size, which is why none of it was covered: an irregular radius, the lettered
           family actually landing, the native <select> caret being replaced, a disabled button
           that reads as waiting rather than broken, the second pen line inside the big frame, and
           the dashboard rows carrying the same course colour the /tasks board does.

           Radii are read corner by corner. A two-axis border-radius serialises per corner as
           "12px 6px", so a hand-drawn shape gives four different strings while a pill gives four
           identical "9999px" ones -- which is exactly what a later override quietly reinstated on
           the course chips once already. */
        const chip = document.querySelector(".subjects-ribbon .subject-chip:not(.active)");
        const qsel = document.querySelector(".quick-add-select");
        const qin2 = document.querySelector(".quick-add-input");
        const qsub = document.querySelector(".quick-add-submit");
        const bigCard = document.querySelector(".master-notebook-card");
        const dcards = [...document.querySelectorAll("#fx-stickyadd .dashboard-task-card")];
        if (chip && qsel && qin2 && qsub && bigCard && dcards.length === 3) {
          const corners = (s) => [
            s.borderTopLeftRadius,
            s.borderTopRightRadius,
            s.borderBottomRightRadius,
            s.borderBottomLeftRadius,
          ];
          const cs = getComputedStyle(chip);
          const ss = getComputedStyle(qsel);
          const subs = getComputedStyle(qsub);
          // All three big frames on the page share one ::after rule, and each supplies its own
          // `position: relative` -- so a frame can lose the line on its own, which is exactly
          // what a probe on one of them would miss.
          const FRAMES = [".notebook-top-header", ".subjects-ribbon", ".master-notebook-card"];
          out.doodle = {
            chipCorners: corners(cs),
            chipFont: cs.fontFamily,
            inputFont: getComputedStyle(qin2).fontFamily,
            selFont: ss.fontFamily,
            selAppearance: ss.appearance,
            selCaret: ss.backgroundImage,
            // background-position has no logical form, so the caret is the one thing on this row
            // that needs a second rule to reach the correct edge in Arabic.
            selCaretPos: ss.backgroundPositionX,
            // The submit is disabled whenever the field is empty, which is most of the time;
            // `.btn:disabled`'s blanket 0.55 opacity is what made the resting row look broken.
            subOpacity: +subs.opacity,
            subBorder: subs.borderTopStyle,
            ringsMissing: FRAMES.filter((sel) => {
              const el = document.querySelector(sel);
              if (!el) return true;
              const r = getComputedStyle(el, "::after");
              // The line is only where it is meant to be if the frame gave it a containing
              // block; without `position: relative` it escapes to the nearest ancestor that has
              // one and draws a ring around something else entirely.
              return (
                r.borderTopStyle !== "dashed" ||
                !(parseFloat(r.borderTopWidth) > 0) ||
                getComputedStyle(el).position === "static"
              );
            }),
            cardPapers: dcards.map((c) => getComputedStyle(c).backgroundColor),
            cardSpines: dcards.map((c) => getComputedStyle(c, "::before").backgroundColor),
            cardCorners: corners(getComputedStyle(dcards[0])),
            cardTilted: dcards.filter((c) => {
              const m = new DOMMatrixReadOnly(getComputedStyle(c).transform);
              return Math.abs(m.b) > 0.001 || Math.abs(m.c) > 0.001;
            }).length,
            cardTitleFont: getComputedStyle(dcards[0].querySelector(".dashboard-task-title")).fontFamily,
            // A spine wider than the padding it is meant to sit in would print under the text.
            cardPadStart: Math.round(parseFloat(getComputedStyle(dcards[0]).paddingInlineStart)),
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

        // ---- /analytics re-skin ----
        // The page's charts are themed entirely through custom properties, including inside SVG
        // presentation attributes, and every panel's decoration lives in a `background-image` that a
        // stray `background:` shorthand would silently erase. Neither is visible in a stylesheet
        // read, and both had already failed once here: six hardcoded hexes painted #263D5B ink onto
        // the #182234 card of the cosmic mood, and the panels' own `background:` was the reason they
        // could not just be appended to the shared corner-mark list.
        const anaRoot = document.getElementById("fx-analytics");
        const anaPanel = anaRoot?.querySelector(".analytics-panel");
        const anaAi = anaRoot?.querySelector(".analytics-ai-panel");
        const anaSel = anaRoot?.querySelector(".analytics-toolbar select");
        const anaLine = anaRoot?.querySelector(".fx-chart-line");
        const anaTip = anaRoot?.querySelector(".analytics-tooltip");
        const anaHeat = anaRoot?.querySelector('.analytics-cal-cell[data-level="4"]');
        if (anaRoot && anaPanel && anaAi && anaSel && anaLine && anaTip && anaHeat) {
          /* A token resolved the way the stylesheet would resolve it, through a throwaway element
             rather than by parsing tokens.css: `color` is the one property whose computed value is
             always an absolute rgb(), so this turns "--primary-strong" into the exact string the
             chart's stroke has to match. Comparing the two is what proves a var() in an SVG
             presentation attribute substitutes at all -- if it silently did not, both the stroke and
             this probe would still be *some* colour and only the equality test would catch it. */
          const token = (name) => {
            const probe = document.createElement("div");
            probe.style.color = `var(${name})`;
            document.body.appendChild(probe);
            const value = getComputedStyle(probe).color;
            probe.remove();
            return value;
          };
          const ps = getComputedStyle(anaPanel);
          const as = getComputedStyle(anaAi);
          const ss = getComputedStyle(anaSel);
          const stops = [...anaRoot.querySelectorAll(".analytics-fill-top, .analytics-fill-bottom")];
          const hour1 = anaRoot.querySelector('.analytics-hourmap[data-step="1"]');
          const hour4 = anaRoot.querySelector('.analytics-hourmap[data-step="4"]');
          const cta = anaRoot.querySelector(".analytics-ai-heading .secondary-button");
          // Both wide frames carry the shared "the pen went round twice" ::after, and each has to
          // declare its own `position: relative` -- so either can lose the line on its own.
          const FRAMES = [".analytics-wide-panel", ".analytics-ai-panel"];
          out.analytics = {
            panelBorder: +parseFloat(ps.borderTopWidth).toFixed(2),
            panelMarks: ps.backgroundImage,
            aiBorder: +parseFloat(as.borderTopWidth).toFixed(2),
            aiMarks: as.backgroundImage,
            selAppearance: ss.appearance,
            selCaret: ss.backgroundImage,
            selCaretPos: ss.backgroundPositionX,
            selH: Math.round(anaSel.getBoundingClientRect().height),
            lineStroke: getComputedStyle(anaLine).stroke,
            lineToken: token("--primary-strong"),
            stopInks: stops.map((s) => getComputedStyle(s).stopColor),
            stopToken: token("--primary"),
            step1Shown: hour1 ? getComputedStyle(hour1).display !== "none" : null,
            step4Shown: hour4 ? getComputedStyle(hour4).display !== "none" : null,
            // Accumulated across the mood runs and compared afterwards: one run only ever sees one
            // mood, so "the tooltip is a different colour in cosmic" is not a within-run assertion.
            tipInk: getComputedStyle(anaTip).borderTopColor,
            heatInk: getComputedStyle(anaHeat).backgroundColor,
            // --subject-color reaches these through [data-color] and is used inside a color-mix()
            // with a fallback, which is three chances to resolve to nothing.
            courseInks: [...anaRoot.querySelectorAll(".analytics-course-grid article")].map((el) => {
              const cs = getComputedStyle(el);
              return [cs.borderTopColor, cs.backgroundColor];
            }),
            swatchInks: [...anaRoot.querySelectorAll(".analytics-legend i")].map(
              (el) => getComputedStyle(el).backgroundColor,
            ),
            deltaInks: ["up", "down", "flat"].map((d) => {
              const el = anaRoot.querySelector(`.analytics-delta[data-direction="${d}"]`);
              return el ? getComputedStyle(el).color : "transparent";
            }),
            // One ink per signal card, from --success/--warning/--primary mixed toward the panel's
            // own foreground. Three tones in the fixture, so three colours, or the tone system is
            // painting six identical cards.
            toneInks: [...anaRoot.querySelectorAll(".analytics-signal-grid article > svg")].map(
              (el) => getComputedStyle(el).color,
            ),
            // The CTA is the only inverted fill in the app: --secondary-foreground on a --secondary
            // card. Those two are a contrast pair by definition, so this is really a check that the
            // base .secondary-button's own `background: var(--surface)` did not win.
            ctaFill: cta ? getComputedStyle(cta).backgroundColor : "transparent",
            aiFill: as.backgroundColor,
            ringsMissing: FRAMES.filter((sel) => {
              const el = anaRoot.querySelector(sel);
              if (!el) return true;
              const r = getComputedStyle(el, "::after");
              return (
                r.borderTopStyle !== "dashed" ||
                !(parseFloat(r.borderTopWidth) > 0) ||
                getComputedStyle(el).position === "static"
              );
            }),
          };
        }

        // ---- /exam-plans/:id fields ----
        /* The one failure on this page that no rectangle in the section sweep can see. Every field
           here is a `<label>` wrapping its control, and the rule that stacks the pair and draws the
           control's box is page-scoped -- there is no `.ui-input` on any of them. If that rule ever
           stops matching, what the fields fall back to is Tailwind's preflight: `border-width: 0`
           and a transparent background, which renders a field as its caption and its value running
           together in one line of body text ("Plan titlefamily medicine exam") inside a box that is
           still exactly the right size. So the caption/control gap and the border are measured
           directly. The textarea is measured too: unstyled, it sits at its default 20-column width
           in the middle of a 54rem card, which is a width the sweep reads as a comfortable fit. */
        const detail = document.getElementById("fx-examdetail");
        if (detail) {
          const fields = [
            ...detail.querySelectorAll(
              ".exam-plan-meta label, .exam-plan-item label:not(.plan-item-select)",
            ),
          ];
          const controls = [...detail.querySelectorAll(".exam-plan-meta, .exam-plan-item")].flatMap(
            (card) => [...card.querySelectorAll('input:not([type="checkbox"]), select, textarea')],
          );
          const navLinks = [...detail.querySelectorAll(".exam-plan-detail-header .page-header a")];
          const facts = [...detail.querySelectorAll(".exam-plan-fact")];
          const feedback = detail.querySelector(".exam-plan-feedback");
          // The hidden state cannot coexist with the visible one in the fixture, so it is built
          // here: what matters is that an empty slot leaves the flow entirely, because the shell is
          // a grid and a zero-height grid item still collects a gap on each side of itself.
          const emptyFeedback = feedback.cloneNode(true);
          emptyFeedback.dataset.visible = "no";
          feedback.after(emptyFeedback);
          const emptyPos = getComputedStyle(emptyFeedback).position;
          emptyFeedback.remove();
          out.detail = {
            fields: fields.length,
            controls: controls.length,
            // Caption above control, with real space between them. A wrapped label whose rule
            // never matched reports a gap of 0 here -- or a negative one, since an inline input
            // sits on the caption's own baseline.
            glued: fields.flatMap((label) => {
              const control = label.querySelector("input, select, textarea");
              const text = [...label.childNodes].find(
                (n) => n.nodeType === 3 && n.textContent.trim(),
              );
              if (!control || !text) return [];
              const range = document.createRange();
              range.selectNodeContents(text);
              const gap = control.getBoundingClientRect().top - range.getBoundingClientRect().bottom;
              return gap >= 2 ? [] : [{ text: text.textContent.trim().slice(0, 24), gap: Math.round(gap) }];
            }),
            borderless: controls
              .filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) < 1)
              .map((el) => el.tagName.toLowerCase()),
            // Against its own label, not the viewport: the label is the column the field was given.
            narrow: [...detail.querySelectorAll("textarea")]
              .map((ta) => {
                const own = ta.getBoundingClientRect().width;
                const box = ta.closest("label").getBoundingClientRect().width;
                return { own: Math.round(own), box: Math.round(box) };
              })
              .filter((m) => m.own < m.box * 0.9),
            // The strip is a wrap-based flex row: three facts across a desktop, one per row on a
            // phone. Anything in between means a fact was squeezed rather than moved.
            factRows: new Set(facts.map((f) => Math.round(f.getBoundingClientRect().top))).size,
            // "New planTasksInsights" -- three anchors with no gap read as one word. The pill's
            // own padding is what separates the first link from the border, so both are measured.
            navGap: navLinks.length < 2
              ? -1
              : Math.round(
                  Math.min(
                    ...navLinks.slice(1).map((a, i) => {
                      const prev = navLinks[i].getBoundingClientRect();
                      const here = a.getBoundingClientRect();
                      return Math.max(here.left - prev.right, prev.left - here.right);
                    }),
                  ),
                ),
            navFramed:
              parseFloat(getComputedStyle(detail.querySelector(".page-header")).borderTopWidth) >= 1,
            emptyFeedbackInFlow: emptyPos === "static" || emptyPos === "relative",
            rejectFramed:
              getComputedStyle(detail.querySelector(".exam-plan-reject-zone")).borderTopStyle ===
              "dashed",
          };
        }

        // ---- /dashboard: the page that would not fit a phone ----
        /* The sweep above already reports the symptom (a document wider than the viewport), but not
           which of the two mechanisms produced it, and they are fixed in different places. So both
           are measured: whether the grid track is wider than the column it was given -- `1fr` is
           `minmax(auto, 1fr)`, so one nowrap row anywhere inside can widen the track, the grid and
           the page -- and whether the two card headers that supply that min-content are allowed to
           wrap. `rows` is the readable form of "did it wrap": one row on a desktop, more than one
           on a phone, where the title, the count, "Add Task" and "View all" cannot share a line. */
        const dash = document.getElementById("fx-dashboard");
        const dgrid = dash?.querySelector(".dashboard-layout-grid");
        if (dash && dgrid) {
          const gr = dgrid.getBoundingClientRect();
          const parentW = dash.getBoundingClientRect().width;
          const cols = [...dgrid.querySelectorAll(":scope > section")];
          /* "Did the header wrap." Counted on the header's own clusters -- the title group and the
             controls group -- by vertical centre, because they are centred against each other and
             have different heights, so their tops never agree even on one line. */
          const headerRows = (el) => {
            const mids = [...el.children]
              .map((c) => {
                const r = c.getBoundingClientRect();
                return r.top + r.height / 2;
              })
              .sort((a, b) => a - b);
            return mids.reduce((n, m, i) => (i && m - mids[i - 1] > 8 ? n + 1 : n), 1);
          };
          const sHead = dash.querySelector(".sticky-tasks-header");
          const cHeads = [...dash.querySelectorAll(".dashboard-card-header")];
          out.dash = {
            // Against the column it was handed, not the viewport: a grid that overflows its own
            // parent is the fault, and it is measurable before anything reaches the page edge.
            gridOver: Math.round(gr.width - parentW),
            // One column below 960px, two above it.
            colTops: new Set(cols.map((c) => Math.round(c.getBoundingClientRect().top))).size,
            colCount: cols.length,
            stickyRows: sHead ? headerRows(sHead) : -1,
            cardRows: cHeads.map(headerRows),
            // The mechanism, checked at every width: a header that may not wrap contributes its
            // whole single-line width as min-content, and `1fr` is `minmax(auto, 1fr)`.
            wrap: [sHead, ...cHeads].map((el) => getComputedStyle(el).flexWrap),
            headOver: Math.max(
              ...[sHead, ...cHeads].map((el) => Math.round(el.scrollWidth - el.clientWidth)),
              0,
            ),
            // The right column's stat tiles were cut off on the phone even though nothing in them
            // is unbreakable -- they were riding a track widened by the left column's header.
            tileHidden: Math.max(
              ...[...dash.querySelectorAll(".grid.grid-cols-3")].map((g) =>
                Math.round(g.scrollWidth - g.clientWidth),
              ),
              0,
            ),
          };
        }

        // ---- /focus session setup, as a phone window ----
        /* The claim is "every control is reachable and nothing is printed over anything else".
           Neither half is a stylesheet read. What makes the overlap possible is that the card is
           both the window and the scroller, so a `position: sticky` footer inside it is lifted off
           its own place in the flow and lands on top of the fields at that height; the fix makes
           the field stack the only scroller and puts the footer back in the flow underneath it.
           So: which element scrolls, whether the footer is still positioned, and -- the finding
           that actually matters -- the largest vertical overlap between the footer and any field. */
        const setup = document.getElementById("fx-focussetup");
        const setupCard = setup?.querySelector(".focus-sidebar-card");
        const setupBody = setup?.querySelector(".focus-setup-body");
        const setupFoot = setup?.querySelector(".focus-setup-footer");
        if (setupCard && setupBody && setupFoot) {
          // The bar's own height, resolved the same way the page resolves it: 0px above the
          // breakpoint, 60px + safe area below it. Read off a throwaway node so the token is
          // measured rather than assumed.
          const rule = document.createElement("div");
          rule.style.cssText = "position:absolute;visibility:hidden;height:var(--mobile-nav-total)";
          document.body.append(rule);
          const navTotal = Math.round(rule.getBoundingClientRect().height);
          rule.remove();
          const cardS = getComputedStyle(setupCard);
          const bodyS = getComputedStyle(setupBody);
          const footS = getComputedStyle(setupFoot);
          const fr = setupFoot.getBoundingClientRect();
          const br = setupBody.getBoundingClientRect();
          const cr = setupCard.getBoundingClientRect();
          const vh = window.innerHeight;
          out.setup = {
            fixed: cardS.position === "fixed",
            footPos: footS.position,
            // Exactly one of these may be a scroller. Two scrollers is the arrangement that
            // lifts the footer; none means the tail of a tall stack is unreachable.
            cardScrolls: Math.round(setupCard.scrollHeight - setupCard.clientHeight),
            bodyScrolls: Math.round(setupBody.scrollHeight - setupBody.clientHeight),
            bodyOverflow: bodyS.overflowY,
            fields: setup.querySelectorAll(".focus-field").length,
            /* Both boxes are full-width children of one column, so a vertical overlap is a visual
               one -- but only for the part of a field that is actually on screen. Each field is
               clipped to its scroll container first (the window's box and the stack's box, which
               are the same box before the stack becomes the scroller), because a field scrolled
               past the bottom edge of the stack has a rect that continues into the footer's band
               and is painted nowhere. Measured at the panel's resting scroll position, which is
               where a student first sees it. */
            overlap: Math.max(
              0,
              ...[...setupBody.querySelectorAll(".focus-field")].map((f) => {
                const r = f.getBoundingClientRect();
                const top = Math.max(r.top, br.top, cr.top);
                const bottom = Math.min(r.bottom, br.bottom, cr.bottom);
                if (bottom <= top) return 0;
                return Math.round(Math.min(bottom, fr.bottom) - Math.max(top, fr.top));
              }),
            ),
            // A footer painted onto the fields is still wrong if it happens not to overlap the
            // rect of a field -- text can print through a transparent background either way.
            footOpaque: !/(,|\/)\s*0(\.\d+)?\)$/.test(footS.backgroundColor.replace(/\s/g, "")),
            footBg: footS.backgroundColor,
            // The way out has to be on screen and clear of the bottom bar, without floating so
            // far up the window that it looks detached from the panel it belongs to.
            footGap: Math.round(vh - fr.bottom),
            footTop: Math.round(fr.top),
            navTotal,
            // A window that scrolls its own last child out of reach is the other half of the
            // failure: the footer must sit inside the card's box, not below it.
            footBelowCard: Math.round(fr.bottom - cr.bottom),
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

    /* Colour, not width, so these sit outside the branch above -- they have to hold at every
       viewport and in every mood. `dead` covers both serialisations a fully transparent
       computed colour can take, since "transparent" is exactly what the broken color-mix()
       used to produce and the whole point of these three checks is to catch that class of
       silent failure rather than this one instance of it. */
    const norm = (c) => c.replace(/\s/g, "");
    const dead = (c) => c === "transparent" || /(,|\/)\s*0\)$/.test(c);
    const distinct = (list) => new Set(list.map(norm)).size;
    if (res.task.papers.some(dead))
      taskBad.push(`a sticky note has no paper colour at all (${res.task.papers.join(" / ")})`);
    if (distinct(res.task.papers) < 2)
      taskBad.push(`both courses painted the same paper (${res.task.papers[0]})`);
    if (distinct(res.task.tags) < 2) taskBad.push("both course tags painted the same fill");
    if (res.task.spines.some(dead)) taskBad.push("a triage spine has no colour");
    if (distinct(res.task.spines) < 2) taskBad.push("high and low drew the same triage spine");
    if (res.task.pills.length !== 4)
      taskBad.push(`expected four priority pills in the fixture, found ${res.task.pills.length}`);
    else if (distinct(res.task.pills) < 4)
      taskBad.push(`the four priority levels resolve to ${distinct(res.task.pills)} colours`);
    if (distinct(res.task.ink) < 2)
      taskBad.push("an overdue card is inked the same as an on-time one");
    if (res.task.markW < 40) taskBad.push(`the doodle watermark is only ${res.task.markW}px wide`);
    if (res.task.barW < 20) taskBad.push(`the subtask progress bar is only ${res.task.barW}px wide`);

    if (!res.vitals) throw new Error("vitals strip probe found nothing -- fixture drifted");
    if (res.vitals.hidden > 1) taskBad.push(`the vitals strip hides ${res.vitals.hidden}px of itself`);
    if (!res.vitals.sameH) taskBad.push("the four vitals are different heights -- a label wrapped");
    const vRows = w <= 768 ? 2 : 1;
    if (res.vitals.rows !== vRows)
      taskBad.push(`vitals laid out on ${res.vitals.rows} rows, expected ${vRows} at ${w}px`);
    // Texture below 480px, information above it.
    if (res.vitals.ecgShown !== w > 480)
      taskBad.push(`the vitals trace is ${res.vitals.ecgShown ? "shown" : "hidden"} at ${w}px`);

    if (!res.sticky) throw new Error("dashboard quick-add probe found nothing -- fixture drifted");
    const stickyBad = [];
    if (res.sticky.glyphW <= 26)
      stickyBad.push(`the drawn scene was crushed to ${res.sticky.glyphW}px by .ui-empty-icon`);
    if (res.sticky.sceneW < 120) stickyBad.push(`the empty scene is only ${res.sticky.sceneW}px wide`);
    if (res.sticky.stampSpill > 0)
      stickyBad.push(`the "All clear" stamp hangs ${res.sticky.stampSpill}px outside the card`);
    if (dead(res.sticky.swatch)) stickyBad.push("the course swatch has no colour");
    if (dead(res.sticky.spine)) stickyBad.push("the priority spine has no colour");
    const sRows = w <= 768 ? 2 : 1;
    if (res.sticky.rows !== sRows)
      stickyBad.push(`course and priority on ${res.sticky.rows} rows, expected ${sRows} at ${w}px`);
    if (w <= 768) {
      if (res.sticky.selH < 44)
        stickyBad.push(`quick-add select is ${res.sticky.selH}px tall, under the 44px floor`);
      if (res.sticky.actionH < 44)
        stickyBad.push(`empty-state action is ${res.sticky.actionH}px tall, under the 44px floor`);
    } else if (res.sticky.selH < 24) {
      stickyBad.push(`quick-add select is only ${res.sticky.selH}px tall`);
    }
    if (!res.doodle) throw new Error("hand-drawn chrome probe found nothing -- fixture drifted");
    const doodleBad = [];
    const LETTERED = "Delius Swash Caps";
    // Four different corner strings is the definition being asserted; three is the tolerance for
    // a shape that happens to repeat one pair, and one means somebody wrote a single radius.
    const wobbly = (c) => new Set(c).size >= 3 && !c.some((v) => v.includes("9999px"));
    if (!wobbly(res.doodle.chipCorners))
      doodleBad.push(`course chip is not hand-drawn: corners ${res.doodle.chipCorners.join(" | ")}`);
    if (!wobbly(res.doodle.cardCorners))
      doodleBad.push(`dashboard task card is not hand-drawn: corners ${res.doodle.cardCorners.join(" | ")}`);
    /* The family check is about the cascade, not the rasteriser: the faces are not installed
       offline, so what this can prove is that --font-label resolved and reached the element
       rather than being dropped to the inherited value -- which is precisely what happened for
       the whole life of this fixture before it started declaring the next/font variables. */
    for (const [what, fam] of [
      ["course chip", res.doodle.chipFont],
      ["quick-add input", res.doodle.inputFont],
      ["quick-add select", res.doodle.selFont],
      ["dashboard task title", res.doodle.cardTitleFont],
    ]) {
      if (!fam.includes(LETTERED)) doodleBad.push(`${what} is not hand-lettered (${fam})`);
    }
    if (res.doodle.selAppearance !== "none")
      doodleBad.push(`the native select chrome is still on (appearance: ${res.doodle.selAppearance})`);
    if (res.doodle.selCaret === "none") doodleBad.push("the drawn select caret is missing");
    /* backgroundPositionX resolves the keyword away -- `right 0.6rem` computes to
       `calc(100% - 9.6px)` and `left 0.6rem` to a bare `9.6px` -- so which edge the caret is
       anchored to is readable from whether the offset is measured off the far edge, not from a
       keyword that is no longer in the value. LTR draws it trailing (far edge), RTL leading. */
    const caretFromFarEdge = res.doodle.selCaretPos.includes("100%");
    if (caretFromFarEdge !== (dir === "ltr"))
      doodleBad.push(
        `the select caret sits at ${res.doodle.selCaretPos} at dir=${dir}, i.e. on the ${
          caretFromFarEdge ? "right" : "left"
        } instead of the ${dir === "rtl" ? "left" : "right"}`,
      );
    if (res.doodle.subOpacity < 0.9)
      doodleBad.push(`the disabled submit is faded to ${res.doodle.subOpacity} -- reads as broken, not as waiting`);
    if (res.doodle.subBorder !== "dashed")
      doodleBad.push(`the disabled submit is drawn ${res.doodle.subBorder}, not dashed`);
    if (res.doodle.ringsMissing.length)
      doodleBad.push(`no inner pen line on ${res.doodle.ringsMissing.join(", ")}`);
    if (res.doodle.cardPapers.some(dead))
      doodleBad.push(`a dashboard task card has no paper at all (${res.doodle.cardPapers.join(" / ")})`);
    if (distinct(res.doodle.cardPapers) < 3)
      doodleBad.push(`three courses painted ${distinct(res.doodle.cardPapers)} papers on the dashboard`);
    if (res.doodle.cardSpines.some(dead)) doodleBad.push("a dashboard card spine has no colour");
    if (distinct(res.doodle.cardSpines) < 3)
      doodleBad.push(`three courses drew ${distinct(res.doodle.cardSpines)} spines on the dashboard`);
    if (res.doodle.cardTilted !== 3)
      doodleBad.push(`${res.doodle.cardTilted}/3 dashboard cards carry the alternating tilt`);
    if (res.doodle.cardPadStart < 20)
      doodleBad.push(`dashboard card leaves ${res.doodle.cardPadStart}px before the text, too tight for the 5px spine`);

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
    if (!res.analytics) throw new Error("analytics probe found nothing -- fixture drifted");
    const analyticsBad = [];
    const ana = res.analytics;
    // Above the breakpoint only: `.analytics-panel`, `.analytics-wide-panel` and
    // `.analytics-ai-panel` are all three in the mobile comfort block, which thins the border by
    // 0.5px at <=768px -- and decoBad above already asserts that thinning from the other side.
    //
    // 2, not 2.5, because Chromium floors border-width to whole CSS pixels in the used value: the
    // 2.5px the family declares is reported as 2px and the comfort block's 1.5px as 1px. The
    // stylesheet is right; this is the number that is measurable. Same reason decoBad's ceiling is
    // 1.5 rather than 1.
    if (w > 768) {
      if (ana.panelBorder < 2) analyticsBad.push(`panel border is ${ana.panelBorder}px, not the 2.5px every other card carries`);
      if (ana.aiBorder < 2) analyticsBad.push(`AI panel border is ${ana.aiBorder}px, not 2.5px`);
    }
    /* The corner marks are a `background-image`, at every width, which is the whole reason these
       panels had to move from the `background:` shorthand to `background-color:` before they could
       join the card family. A shorthand added back anywhere -- base rule, mood override, media
       query -- silently resets this to `none` and nothing else in the file would notice. */
    if (ana.panelMarks === "none") analyticsBad.push("panel lost its corner marks (background-image: none)");
    if (ana.aiMarks === "none") analyticsBad.push("AI panel lost its inverted corner marks");
    if (ana.selAppearance !== "none")
      analyticsBad.push(`the range select still wears OS chrome (appearance: ${ana.selAppearance})`);
    if (ana.selCaret === "none") analyticsBad.push("the drawn caret is missing from the toolbar select");
    const anaCaretFar = ana.selCaretPos.includes("100%");
    if (anaCaretFar !== (dir === "ltr"))
      analyticsBad.push(`toolbar caret sits at ${ana.selCaretPos} at dir=${dir}, i.e. on the leading edge`);
    // 2.75rem in the base rule, so this holds at every width rather than only on coarse pointers.
    if (ana.selH < 44) analyticsBad.push(`toolbar select is ${ana.selH}px tall, under the 44px floor`);
    /* The load-bearing claim of the whole re-skin: a var() inside an SVG presentation attribute
       substitutes, so recharts can be themed from tokens instead of hex literals. Equality against
       the same token resolved through a real element is what proves it -- a `stroke` that failed to
       substitute would fall back to black, which is a colour, so "is it painted" proves nothing. */
    if (norm(ana.lineStroke) !== norm(ana.lineToken))
      analyticsBad.push(`var() did not substitute in an SVG stroke: got ${ana.lineStroke}, --primary-strong is ${ana.lineToken}`);
    if (ana.stopInks.length !== 2)
      analyticsBad.push(`expected two gradient stops in the fixture, found ${ana.stopInks.length}`);
    for (const ink of ana.stopInks) {
      // stop-color is the one property that never relies on the attribute path -- the stops take
      // their colour from a class -- so this is the check that the class actually reached them.
      if (dead(ink) || norm(ink) !== norm(ana.stopToken))
        analyticsBad.push(`a gradient stop is ${ink}, not --primary (${ana.stopToken})`);
    }
    // 24 columns are unreadable on a phone, so below 480px the day x hour map buckets to 4 hours.
    // Both halves asserted: "always the coarse one" would pass a no-overflow test just as well.
    const wantStep4 = w <= 480;
    if (ana.step4Shown !== wantStep4 || ana.step1Shown === wantStep4)
      analyticsBad.push(
        `at ${w}px the hour map is showing the ${ana.step1Shown ? "hourly" : "4-hour"} grid, expected the ${wantStep4 ? "4-hour" : "hourly"} one`,
      );
    if (dead(ana.tipInk)) analyticsBad.push("the tooltip has no border colour");
    if (dead(ana.heatInk)) analyticsBad.push("the busiest heat cell has no fill");
    if (ana.courseInks.flat().some(dead))
      analyticsBad.push(`a course card has no ink at all (${ana.courseInks.flat().join(" / ")})`);
    // --subject-color reaches these through [data-color] and is consumed inside a color-mix() that
    // carries its own fallback: three places it can resolve to nothing and still render a card.
    if (distinct(ana.courseInks.map((pair) => pair[0])) < 2)
      analyticsBad.push("both course cards drew the same border -- --subject-color did not reach them");
    if (distinct(ana.courseInks.map((pair) => pair[1])) < 2)
      analyticsBad.push("both course cards are washed the same colour");
    if (ana.swatchInks.some(dead)) analyticsBad.push("a donut legend swatch has no colour");
    if (distinct(ana.swatchInks) < 2) analyticsBad.push("both legend swatches painted the same course colour");
    if (ana.deltaInks.some(dead)) analyticsBad.push("a period delta chip has no ink");
    // up vs down/flat, not three distinct: down and flat deliberately share --muted, because a
    // quiet week is not painted red on this page.
    if (distinct(ana.deltaInks) < 2) analyticsBad.push("an upward delta is inked the same as a downward one");
    if (ana.toneInks.length !== 6)
      analyticsBad.push(`expected six signal cards in the fixture, found ${ana.toneInks.length}`);
    if (ana.toneInks.some(dead)) analyticsBad.push("a signal card icon has no ink");
    if (distinct(ana.toneInks) < 3)
      analyticsBad.push(`the three signal tones resolve to ${distinct(ana.toneInks)} colours -- --signal-ink is not switching`);
    if (dead(ana.ctaFill) || norm(ana.ctaFill) === norm(ana.aiFill))
      analyticsBad.push(`the "Deeper insights" fill is ${ana.ctaFill} on a ${ana.aiFill} slab -- the base button's --surface won`);
    if (ana.ringsMissing.length) analyticsBad.push(`no second pen line on ${ana.ringsMissing.join(", ")}`);
    // Keyed by mood, so the RTL run overwrites its own LTR twin rather than a different palette.
    CHART_INK[mood] = { tip: ana.tipInk, heat: ana.heatInk, cta: ana.ctaFill, signal: ana.toneInks[0] };

    if (!res.detail) throw new Error("proposal-page probe found nothing -- fixture drifted");
    const detailBad = [];
    const det = res.detail;
    // The fixture is fixed, so a drop in either count means a selector stopped matching -- which is
    // the exact failure the rest of this block is written to catch, arriving silently.
    if (det.fields !== 11) detailBad.push(`matched ${det.fields} labelled fields, expected 11`);
    if (det.controls !== 11) detailBad.push(`matched ${det.controls} controls, expected 11`);
    for (const g of det.glued)
      detailBad.push(`"${g.text}" sits ${g.gap}px from its control -- the label did not stack`);
    if (det.borderless.length)
      detailBad.push(`${det.borderless.length} field(s) have no border at all (${det.borderless.join(", ")})`);
    for (const n of det.narrow)
      detailBad.push(`a textarea is ${n.own}px wide inside a ${n.box}px field -- it kept its default column count`);
    // Three across from 769px, one per row below it. Two rows means one fact was squeezed instead.
    const wantFactRows = w <= 768 ? 3 : 1;
    if (det.factRows !== wantFactRows)
      detailBad.push(`the AI strip is on ${det.factRows} row(s) at ${w}px, expected ${wantFactRows}`);
    if (det.navGap < 1) detailBad.push(`the header nav links are ${det.navGap}px apart -- they read as one word`);
    if (!det.navFramed) detailBad.push("the header nav is not rendering as a bordered pill");
    if (det.emptyFeedbackInFlow)
      detailBad.push("an empty feedback slot is still in the shell's grid, so it still collects a gap");
    if (!det.rejectFramed) detailBad.push("the reject zone has no dashed frame");

    if (!res.dash) throw new Error("dashboard page probe found nothing -- fixture drifted");
    const dashBad = [];
    if (res.dash.colCount !== 2)
      dashBad.push(`expected two dashboard columns in the fixture, found ${res.dash.colCount}`);
    if (res.dash.gridOver > 1)
      dashBad.push(`the layout grid is ${res.dash.gridOver}px wider than the page column it sits in`);
    if (res.dash.tileHidden > 1)
      dashBad.push(`the stat tiles hide ${res.dash.tileHidden}px of themselves`);
    // One column below 960px, side by side above it. The single-column case is where the overflow
    // lived, because every row then shares one track: the left column's header set the width the
    // right column's tiles were cut to.
    const wantStacked = w <= 960;
    if ((res.dash.colTops === 2) !== wantStacked)
      dashBad.push(
        `the columns are ${res.dash.colTops === 2 ? "stacked" : "side by side"} at ${w}px, expected the ${wantStacked ? "stacked" : "side by side"} layout`,
      );
    /* The headers are the min-content the grid was sizing to, so what is asserted is that they are
       allowed to break -- at every width, because with room to spare a wrapping header still
       renders on one line, and it is the permission that stops the track from being widened.
       Then the two ends of the range: below 480px "Today's Tasks (3)" plus "Add Task" plus
       "View all" is about 360px of content in a card whose inside is roughly 285px, so it has to
       be on two rows; from 768px up there is room for all of it on one, and a header that wraps
       there has simply lost its alignment. */
    for (const [i, wrap] of res.dash.wrap.entries()) {
      if (!wrap.includes("wrap"))
        dashBad.push(`${i ? `dashboard card header ${i}` : "the Today's Tasks header"} is flex-wrap: ${wrap}`);
    }
    if (res.dash.headOver > 1)
      dashBad.push(`a card header hides ${res.dash.headOver}px of itself`);
    if (w <= 480 && res.dash.stickyRows !== 2)
      dashBad.push(`the Today's Tasks header is on ${res.dash.stickyRows} row(s) at ${w}px, expected 2`);
    if (w >= 768) {
      if (res.dash.stickyRows !== 1)
        dashBad.push(`the Today's Tasks header wrapped to ${res.dash.stickyRows} rows at ${w}px`);
      for (const [i, rows] of res.dash.cardRows.entries()) {
        if (rows !== 1) dashBad.push(`dashboard card header ${i + 1} wrapped to ${rows} rows at ${w}px`);
      }
    }

    if (!res.setup) throw new Error("focus setup probe found nothing -- fixture drifted");
    const setupBad = [];
    const st = res.setup;
    if (st.fields !== 5) setupBad.push(`matched ${st.fields} setup fields, expected 5`);
    // The one finding that describes what the page looked like: a control printed over a control.
    if (st.overlap > 0)
      setupBad.push(`the footer is printed over a field for ${st.overlap}px of its height`);
    // Only meaningful where something can pass underneath it, which after the fix is nowhere --
    // so this is the guard on the arrangement, not on the colour.
    if ((st.cardScrolls > 1 || st.footPos !== "static") && !st.footOpaque)
      setupBad.push(`the footer background is ${st.footBg} -- the fields print straight through it`);
    if (st.footBelowCard > 1)
      setupBad.push(`the footer hangs ${st.footBelowCard}px below the panel's own box`);
    if (w <= 860) {
      if (!st.fixed) setupBad.push("the setup panel is not the full-bleed window below 860px");
      // Two scrollers is what lifts the footer; the field stack must be the only one.
      if (st.cardScrolls > 1)
        setupBad.push(`the window itself scrolls ${st.cardScrolls}px -- the field stack should be the scroller`);
      if (st.footPos !== "static" && st.footPos !== "relative")
        setupBad.push(`the footer is position: ${st.footPos}, so it is lifted off its place in the stack`);
      if (st.bodyOverflow !== "auto" && st.bodyOverflow !== "scroll")
        setupBad.push(`the field stack is overflow-y: ${st.bodyOverflow}, so a tall stack has nowhere to go`);
      // "The way out is never a scroll away": on screen and clear of the bottom bar. The upper
      // bound only applies once the stack is actually scrolling -- with a short stack in a tall
      // window the footer follows the last field, which is where it belongs.
      if (st.footGap < st.navTotal)
        setupBad.push(`the footer's bottom is ${st.footGap}px off the screen edge, inside the ${st.navTotal}px bottom bar`);
      if (st.bodyScrolls > 1 && st.footGap > st.navTotal + 40)
        setupBad.push(`the fields scroll but the footer floats ${st.footGap - st.navTotal}px above the bottom bar`);
      if (st.footTop < 0) setupBad.push(`the footer starts ${-st.footTop}px above the top of the screen`);
    } else {
      if (st.fixed) setupBad.push("the desktop sidebar is still the phone window");
      if (st.bodyScrolls > 1)
        setupBad.push(`the desktop field stack scrolls ${st.bodyScrolls}px inside a sidebar that should grow`);
    }

    const bad =
      res.doc > 1 ||
      res.clipped.length ||
      res.tiny.length ||
      res.spill.length ||
      navBad ||
      decoBad.length ||
      hdrBad.length ||
      taskBad.length ||
      stickyBad.length ||
      doodleBad.length ||
      timerBad.length ||
      analyticsBad.length ||
      detailBad.length ||
      dashBad.length ||
      setupBad.length;
    if (bad) fail++;
    console.log(
      `\n[${tag}] doc=+${res.doc} clipped=${res.clipped.length} tiny=${res.tiny.length} spill=${res.spill.length}` +
        (res.nav ? ` nav=${res.nav.shown ? `${res.nav.navH}px` : "hidden"} padB=${res.nav.padB}` : "") +
        ` hdr=h1:${res.hdr.h1}px/${res.hdr.xs ? "xs" : res.hdr.base ? "base" : "?"}` +
        ` task=${res.task.tilted ? "tilt" : "flat"}/${res.task.tape ? "tape" : "notape"}/minH${res.task.minH}` +
        ` vitals=${res.vitals.rows}row/${res.vitals.ecgShown ? "ecg" : "noecg"}` +
        ` sticky=${res.sticky.rows}row/glyph${res.sticky.glyphW}px/sel${res.sticky.selH}px` +
        ` doodle=${new Set(res.doodle.chipCorners).size}corner/${res.doodle.selAppearance}/tilt${res.doodle.cardTilted}` +
        ` timer=pill${res.timer.indOffset}px/plate${res.timer.plateR}<=${res.timer.tickInnerR}<${res.timer.tickOuterR}<=${res.timer.ringInnerR}/digits${res.timer.digitsW}` +
        ` fs=${res.timer.fs.plateR}<=${res.timer.fs.ringInnerR}/digits${res.timer.fs.digitsW}` +
        ` art=${res.timer.fs.art.map((a) => (a.shown ? `${a.w}px` : "off")).join("+")}` +
        ` ana=${ana.panelBorder}px/${ana.panelMarks === "none" ? "nomarks" : "marks"}/sel${ana.selH}px/${ana.step1Shown ? "24h" : "4h"}/${distinct(ana.toneInks)}tone` +
        ` plan=${det.fields}field/${det.factRows}factrow/nav${det.navGap}px` +
        ` dash=${res.dash.colTops}col/head${res.dash.stickyRows}+${res.dash.cardRows.join("+")}row/over${res.dash.gridOver}px` +
        ` setup=${st.fixed ? "window" : "sidebar"}/scroll${st.cardScrolls}:${st.bodyScrolls}/over${st.overlap}px/gap${st.footGap}px`,
    );
    for (const c of res.clipped)
      console.log(
        `    ${c.spill !== undefined ? `SPILL +${c.spill}px w=${c.w}` : `CLIP ${c.clientW}<-${c.scrollW} (hidden ${c.hidden})`}  ${c.sel}   [${c.label}]`,
      );
    for (const t of res.tiny) console.log(`    TINY  ${t.sel} ${t.w}x${t.h}`);
    for (const s of res.spill)
      console.log(`    SPILL "${s.text}" overflows its button by ${s.over}px (${s.inner}px inside .${s.cls})`);
    if (res.nav?.overlap > 0) console.log(`    NAV-OVERLAP  bar covers last ${res.nav.overlap}px of the page`);
    if (res.nav?.wasted > 0) console.log(`    NAV-WASTED   ${res.nav.wasted}px dead strip with no bar rendered`);
    for (const d of decoBad)
      console.log(
        `    DECO  ${d.sel} border=${d.bw}px xsShadow=${d.xs} -- expected xs shadow and border <=1.5px`,
      );
    for (const m of hdrBad) console.log(`    HDR   ${m}`);
    for (const m of taskBad) console.log(`    TASK  ${m}`);
    for (const m of stickyBad) console.log(`    STICKY ${m}`);
    for (const m of doodleBad) console.log(`    DOODLE ${m}`);
    for (const m of timerBad) console.log(`    TIMER ${m}`);
    for (const m of analyticsBad) console.log(`    ANALYTICS ${m}`);
    for (const m of detailBad) console.log(`    PLAN  ${m}`);
    for (const m of dashBad) console.log(`    DASH  ${m}`);
    for (const m of setupBad) console.log(`    SETUP ${m}`);
    for (const t of res.viaLabel)
      console.log(`    ok(label) ${t.sel} ${t.w}x${t.h} -> clickable label ${t.lw}x${t.lh}`);
    await ctx.close();
  }
}

/* ================= chart ink follows the mood =================
 * The one assertion in this file that spans runs. cosmic is the single dark mood -- `--surface` is
 * #182234 there against a pale sheet in the other four -- so every value the charts and the AI slab
 * paint with has to come out different in cosmic than in notebook. Four samples, one per mechanism,
 * because they fail independently: the tooltip is a plain CSS border, the heat cell is a
 * `color-mix()` of --primary at a data-level alpha, the CTA is the inverted --secondary-foreground
 * fill, and the signal ink is a mix toward the slab's own foreground.
 *
 * A single-mood check cannot catch this. Hardcoded hexes look right in whichever mood they were
 * eyeballed in, which is exactly how #263D5B ink ended up on a #182234 card for the whole life of
 * this page -- every within-run test passed, in all five moods, the entire time. */
const inkBad = [];
const litMoods = Object.keys(CHART_INK);
if (litMoods.length !== 5)
  inkBad.push(`only ${litMoods.length} of 5 moods recorded chart ink (${litMoods.join(", ")})`);
if (CHART_INK.notebook && CHART_INK.cosmic) {
  for (const [what, key] of [
    ["tooltip border", "tip"],
    ["heat cell fill", "heat"],
    ['"Deeper insights" fill', "cta"],
    ["signal card ink", "signal"],
  ]) {
    const light = CHART_INK.notebook[key];
    const dark = CHART_INK.cosmic[key];
    if (light.replace(/\s/g, "") === dark.replace(/\s/g, ""))
      inkBad.push(`${what} is ${light} in both notebook and cosmic -- it is not reading a token`);
  }
}
if (inkBad.length) {
  fail++;
  console.log("\n[chart ink across moods]");
  for (const m of inkBad) console.log(`    INK   ${m}`);
} else if (CHART_INK.cosmic) {
  console.log(
    `\n[chart ink across moods] tooltip ${CHART_INK.notebook.tip} -> ${CHART_INK.cosmic.tip}, heat ${CHART_INK.notebook.heat} -> ${CHART_INK.cosmic.heat}`,
  );
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
  // 13 nav items in four groups, plus Notifications and Settings in the footer.
  if (sb.links !== 15) sbBad.push(`expected 15 sidebar links, found ${sb.links} -- fixture drifted`);
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