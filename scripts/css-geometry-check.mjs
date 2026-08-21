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
  ["fx-tabs", "/tasks header + chips", [".notebook-top-header", ".notebook-filter-tabs", ".header-branding", ".header-actions", ".task-vitals-strip", ".task-vitals", ".task-vital", ".subjects-ribbon", ".subjects-ribbon-row", ".subjects-scroll"]],
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
  // `.dashboard-hero-art` is absent for the same reason `.empty-scene` is: the atlas skin gives it a
  // negative inline inset so it bleeds off the card's trailing edge, and a scan that reports every
  // element wider than its box would call that a defect at every desktop width. It is measured in
  // the dashboard probe instead, against the hero's own clip. `.dashboard-left-col` and
  // `.dashboard-right-col` are real flex columns in both skins now, so both have boxes and both
  // are swept.
  // `.dashboard-memo-card` came off this list with the AI-insight tile: it is not on the dashboard
  // any more, though the class is still live on /insights and in the exam-plan editor, so its rules
  // stay in components.css and the mobile comfort block still proves them via the synthetic DECO
  // probe further down, which builds its own elements and needs no fixture markup.
  ["fx-dashboard", "/dashboard two-column page", [".dashboard-hero-card", ".dashboard-hero-content", ".dashboard-hero-actions", ".dashboard-layout-grid", ".dashboard-left-col", ".dashboard-right-col", ".today-tasks-sticky-card", ".sticky-tasks-header", ".sticky-tasks-list", ".dashboard-card", ".dashboard-card-header", ".week-chart", ".week-chart-plot", ".week-chart-axis", ".study-rhythm-body", ".dashboard-progress", ".dashboard-goals-list", ".goal-item-card"]],
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
  // Phase 5, Batch B. Three route workspaces the earlier sections never carried, plus the four
  // goal tiles the pastel-cycle probe below reads. `.friend-avatar` blobs and the scoreboard's
  // drawn initials are absent on purpose: nothing about them can overflow, and their material is
  // asserted in the batch B probe instead.
  ["fx-leaderboard", "/leaderboards workspace", [".leaderboard-controls", ".segmented-control", ".leaderboard-filter-row", ".leaderboard-summary", ".my-rank", ".leaderboard-table-panel", ".leaderboard-table-wrap", ".privacy-card"]],
  ["fx-social", "/friends workspace", [".friends-vitals", ".friends-vitals > article", ".social-columns", ".social-panel", ".social-results", ".social-row", ".social-empty", ".friend-grid", ".friend-card", ".friend-more", ".friend-confirm"]],
  ["fx-challenges", "/challenges list + composer + detail + result", [".challenge-stats", ".challenge-stats > article", ".challenge-list", ".challenge-list-card", ".challenge-score-pair", ".challenge-side-panel", ".badge-list", ".challenge-composer", ".composer-step", ".opponent-picker", ".composer-presets", ".composer-summary", ".composer-rules", ".composer-actions", ".challenge-detail-grid", ".challenge-event-panel", ".challenge-scoreboard", ".challenge-progress-track", ".challenge-rule-panel", ".detail-metrics", ".result-layout", ".result-score-band", ".result-outcome", ".result-participants", ".result-badge-panel", ".result-badges", ".result-note", ".share-card-preview", ".share-controls", ".reflection-card", ".distraction-log"]],
  ["fx-goalcards", "/goals tiles (pastel cycle)", [".goal-card"]],
  // Phase 5, Batch C. The settings hub and the auth front door. `.auth-brand-doodle` and its
  // svgs are deliberately absent: they sit at negative insets on purpose (the column's own
  // overflow clips them) and a rectangle sweep would call them spills, exactly like the
  // watermarks before them. `.auth-content` IS swept -- it is the page's one big card.
  ["fx-settings", "/settings hub", [".settings-page-wrapper", ".settings-hero-header", ".settings-status-badge", ".settings-category-tabs", ".settings-notebook-card", ".card-header-line", ".doodle-input", ".doodle-select", ".lang-option", ".theme-card-btn", ".study-mood-card-grid", ".study-mood-card", ".form-submit-row"]],
  ["fx-auth", "/auth front door", [".auth-brand", ".auth-brand-inner", ".auth-headline", ".auth-brand-point", ".auth-mood-ribbon", ".auth-panel", ".auth-content", ".auth-subtitle", ".auth-notice", ".auth-form", ".auth-field-control", ".auth-strength-track", ".auth-stepper-row", ".auth-preset-btn", ".auth-toggle-list", ".auth-toggle-row", ".auth-switch", ".auth-review-list", ".auth-links"]],
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
  // Left the horizontal scroller, so it is now a control of its own rather than one more chip
  // covered by the line above -- and below the breakpoint it is the only way to add a course.
  ".subject-add-chip",
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

/* Phase 5, Batch A. The material pass reaches ~40 surfaces across five routes, and the fixture only
   carries markup for a handful of them -- so most of that work would ship measured by nothing. This
   is the cheap half of the guard: build each selector as a detached element and read what border it
   is handed, which needs no fixture markup because a border is decided by the cascade alone.

   The claim is per skin and deliberately two-sided: doodle draws >=2px of ink, atlas hands out a
   <=1px rim. Either direction failing is a real defect -- an atlas rule that never landed, or a
   doodle rule this pass damaged on its way past.

   Membership rule for this list: the base rule declares 2px or more on at least one side, and the
   selector is NOT in the mobile comfort block above. Both exclusions matter. Chromium floors
   border-width to whole CSS pixels in the used value, so a declared 1.5px is reported as 1px and
   would fail the doodle half of the assertion while being perfectly correct -- which is also why
   Batch A styles those thinner borders with `border-color` alone and they need no entry here. And a
   comfort-block member is thinned to 1.5px on a phone by globals.css, so its doodle width depends on
   the viewport; decoBad already measures those from the other side. */
const P5_SELECTORS = [
  // /analytics
  ".analytics-sidebar",
  ".analytics-toolbar",
  ".analytics-summary article",
  ".analytics-sidebar-note",
  ".analytics-streak",
  ".analytics-tooltip",
  ".analytics-course-grid article",
  ".analytics-signal-grid article",
  // /insights
  ".insight-status-strip",
  ".insight-status-icon",
  ".insight-toolbar",
  ".insight-toggle-button",
  ".insight-alert",
  ".insight-empty-state",
  ".insight-empty-icon",
  // /goals
  ".goal-doodle-form",
  ".goal-form-header",
  ".goal-form-actions",
  ".goal-card-header",
  ".goal-form-field input",
  ".goal-metric-tab-btn",
  // /sessions
  ".session-row",
  ".session-state",
  ".manual-session-form input",
  ".detail-notes",
  ".subtask-section",
  // /calendar
  ".calendar-toolbar",
  ".calendar-nav button",
  ".view-tabs",
  ".calendar-day",
  ".day-drawer",
  ".day-drawer-header",
  ".day-drawer-add input",
  ".day-drawer-add button",
  ".week-day",
  ".week-day-header",
  ".agenda-list section",
  ".agenda-list h3",
  ".calendar-source-bar",
  ".calendar-source-tabs",
  ".calendar-source-picker select",
  ".calendar-copy-box",
  ".calendar-copy-box button",
  ".exam-view-tabs",
  // Phase 5, Batch B -- /leaderboards, /friends, /challenges + composer, /exam-plans, plan forum.
  // Same membership rule as above: the base rule declares >=2px on at least one side and the
  // selector is not in the mobile comfort block. That excludes the 1.5px chips (.year-pill,
  // .challenge-status, .social-flag, .pair-status, .event-mark) which Batch B styles with
  // border-color alone, and the comfort members (.plan-card, .exam-topic-card,
  // .exam-strategy-card, .plan-day-note) which it deliberately leaves shadowless.
  ".leaderboard-controls",
  ".leaderboard-summary",
  ".leaderboard-table-wrap",
  ".leaderboard-filter-row select",
  ".my-rank",
  ".segmented-control",
  ".friends-vitals article",
  ".social-row",
  ".social-count",
  ".social-empty",
  ".friend-confirm",
  ".challenge-composer",
  ".composer-filter",
  ".composer-field input",
  ".composer-field select",
  ".opponent-picker label",
  ".composer-preset",
  ".composer-summary",
  ".composer-rules",
  ".form-feedback",
  ".composer-warning",
  ".challenge-composer .form-error",
  ".challenge-empty",
  ".challenge-stats article",
  ".challenge-score-pair",
  ".challenge-side-panel section",
  ".badge-list article",
  ".challenge-invite-band",
  ".challenge-time-band",
  ".challenge-event-panel",
  ".challenge-rule-panel",
  ".detail-metrics",
  ".result-score-band",
  ".result-outcome",
  ".result-participants",
  ".share-card-preview",
  ".result-note",
  ".exam-plan-meta",
  ".exam-plan-item",
  ".exam-plan-meta input",
  ".exam-plan-conversion",
  ".exam-plan-share",
  ".exam-plan-reject-zone",
  ".task-conversion-confirmation",
  ".wizard-container",
  ".exam-review-card",
  ".exam-rest-days",
  ".plan-new-pad",
  ".plan-board-head",
  ".plan-shelf-empty",
  ".plan-board-notice",
  ".plan-edit-row",
  ".plan-span-readout",
  ".plan-create-btn",
  ".plan-note-form",
  // Phase 5, Batch C -- editor panel, wizard remainder, settings hub, auth front door. Comfort
  // members stay off the list (.editor-panel, .settings-notebook-card, .study-mood-card,
  // .auth-content), as do the 1.5px controls (.study-mood-trigger-btn, .study-mood-sidebar-btn,
  // .auth-stepper-btn, .auth-toggle-icon) which get border-color alone.
  ".task-form input",
  ".wizard-step-line",
  ".wizard-step-actions",
  ".settings-hero-header",
  ".settings-category-tabs",
  ".card-header-line",
  ".doodle-input",
  ".lang-option",
  ".theme-card-btn",
  ".form-submit-row",
  ".study-mood-dropdown-menu",
  ".auth-brand",
  ".auth-form input",
  ".auth-stepper-row",
  ".auth-preset-btn",
  ".auth-toggle-list",
  ".auth-review-list",
  ".auth-notice",
  // Global control pass. The probe builds a bare .btn (no ghost), which is exactly the element
  // the atlas `:not(.btn-ghost)` rule matches -- and the ghost's borderlessness is asserted
  // separately in the batch B probe below via its computed width.
  ".btn",
  ".primary-button",
  ".secondary-button",
  ".danger-button",
];
console.log(`[batch A+B+C] ${P5_SELECTORS.length} Batch A/B/C surfaces measured for border weight`);

/* Every mood in LTR, plus one RTL sweep. Arabic is half of this app's traffic and the
   failure mode is a physical property -- a padding-left or a margin-right that looks
   correct in English and lands on the wrong edge in Arabic. One mood is enough for that:
   direction is orthogonal to the palette, and nothing in tokens.css is direction-aware.

   The skin is the second axis, and it has to be stamped explicitly. `:root[data-skin=...]`
   only matches when the attribute is PRESENT, so a fixture that never sets it falls through
   to the bare-`:root` doodle defaults -- which would mean this whole harness kept measuring
   the old skin while the new one shipped unverified. Atlas is the default, so it gets the
   full palette sweep; doodle is now a user-selectable choice rather than dead code, so it
   gets a regression guard. Two moods there, because the only palette-shaped thing in the
   doodle material block is its shadow ink, and cosmic is the one mood that inverts it. */
const RUNS = [
  ...["notebook", "cosmic", "sakura", "aurora", "sunset"].map((m) => ["atlas", m, "ltr"]),
  ["atlas", "notebook", "rtl"],
  ["doodle", "notebook", "ltr"],
  ["doodle", "cosmic", "ltr"],
  ["doodle", "notebook", "rtl"],
];

/* One run only ever sees one mood, so "the chart ink is a different colour in cosmic" is not a
   within-run assertion -- it is a comparison between two runs. Filled during the sweep and checked
   after it, because that comparison is the direct regression test for the fault this pass removed:
   six hardcoded hexes painting #263D5B ink onto the #182234 card of the one dark mood. A palette
   that is mood-blind again would still pass every other check in this file. */
const CHART_INK = {};

for (const [skin, mood, dir] of RUNS) {
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
    /* Settle every animation instantly. Phase 7 put a 160ms slide on the timer's mode
       indicator, a 280ms entrance on the dial and an infinite breathing loop on the ring, and
       a harness that measures rectangles cannot measure them mid-flight: the first RTL run
       here reported the indicator 74px off its tab, which was not a layout bug at all but the
       slide caught at 95% of its travel. A zero duration with the fill mode intact lands each
       animation on its end state, and the breathing loop -- which has no fill mode -- falls
       back to scale(1) instead of oscillating the ring's width by 1.5% under the assertions.

       This has to run BEFORE the axes are stamped, not after. Flipping `data-skin` changes the
       radius, border and shadow of everything on the page, and `.subject-chip` (among others)
       carries `transition: all var(--transition-fast)` -- so the flip starts a real transition.
       Lowering `transition-duration` afterwards does not shorten a transition that is already
       running, so the old order left one in flight and raced the 120ms wait against it. It
       mostly won, which is the worst kind of bug: `atlas/aurora 360x800` alone reported the
       course chip mid-interpolation between doodle's wobbly radius and atlas's uniform one,
       and read as a real material regression on one arbitrary combo. Killing transitions first
       means the attribute flip is instantaneous and there is nothing to wait for. */
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important;" +
        " transition-duration: 0s !important; transition-delay: 0s !important; }",
    });
    await page.evaluate(
      ({ s, m, d }) => {
        document.documentElement.dataset.skin = s;
        document.documentElement.dataset.mood = m;
        document.documentElement.dir = d;
      },
      { s: skin, m: mood, d: dir },
    );
    await page.waitForTimeout(120);

    const res = await page.evaluate(
      ({ SECTIONS, TAP, DECO_SELECTORS, P5_SELECTORS }) => {
        const vw = document.documentElement.clientWidth;
        const out = { vw, doc: document.documentElement.scrollWidth - vw, clipped: [], tiny: [], spill: [], viaLabel: [] };
        /* Resolve a colour expression the way the page would, so an assertion can name the value
           it wants in the same language the stylesheet uses instead of hardcoding 30 per-mood
           hexes. The node is created and removed per call: leaving one parked in the body would
           survive into the next viewport iteration and show up in the overflow sweep. */
        const resolveBg = (expr) => {
          const n = document.createElement("span");
          n.style.cssText = "position:absolute;left:-9999px;top:-9999px";
          n.style.backgroundColor = expr;
          document.body.appendChild(n);
          const got = getComputedStyle(n).backgroundColor;
          n.remove();
          return got;
        };
        /* The paper the task surfaces are supposed to be painted with: a percentage of the mood's
           own `--primary` over whichever base the active skin uses. This is the answer to "why is
           everything green" -- the paper used to be mixed from the course colour, so a green course
           made a green note in a pink mood. One expression, both skins, because the only thing that
           changes is what the tint sits on. */
        const skinNow = document.documentElement.dataset.skin || "doodle";
        const wantPaper = (pct) =>
          resolveBg(
            skinNow === "atlas"
              ? `color-mix(in srgb, var(--primary) ${pct}%, var(--glass-bg-raised))`
              : `color-mix(in srgb, var(--primary) ${pct}%, var(--surface))`,
          );
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
        /* What the xs step actually looks like, resolved at runtime instead of hardcoded.
           This used to be a literal /^1\.5px 1\.5px/ pattern, which is the doodle value --
           under Atlas `--shadow-doodle-xs` remaps to a soft elevation, so that pattern
           would have failed all ~50 selectors on every Atlas mobile pass and buried the
           real findings.

           The probe is what makes the comparison possible: getComputedStyle normalises a
           box-shadow (colour moves to the front, `0` becomes `0px`), so the token's source
           text can never be compared against a card's computed value directly. Pushing the
           token through an element and reading it back puts both sides through the same
           normalisation, which also makes this stricter than the old prefix test -- it now
           compares the whole shadow, not just its first two lengths. */
        const shadowOf = (token) => {
          const el = document.createElement("div");
          el.style.cssText = `position:absolute;left:-9999px;top:0;width:10px;box-shadow:var(${token})`;
          document.body.appendChild(el);
          const v = getComputedStyle(el).boxShadow;
          el.remove();
          return v;
        };
        const xsShadow = shadowOf("--shadow-doodle-xs");
        out.xsShadow = xsShadow;
        const probe = document.createElement("div");
        probe.style.cssText = "position:absolute;left:-9999px;top:0;width:200px";
        document.body.appendChild(probe);
        /* Builds `.card`, `.a.b`, `.list article` and `.field input` alike: a leading dot means a div
           carrying those classes, anything else is that tag name. */
        const build = (sel, root) => {
          let host = root;
          let leaf = null;
          for (const part of sel.trim().split(/\s+/)) {
            const el = document.createElement(part.startsWith(".") ? "div" : part);
            for (const c of part.split(".").filter(Boolean)) el.classList.add(c);
            host.appendChild(el);
            host = el;
            leaf = el;
          }
          return leaf;
        };
        for (const sel of DECO_SELECTORS) {
          const st = getComputedStyle(build(sel, probe));
          out.deco.push({
            sel,
            bw: +parseFloat(st.borderTopWidth).toFixed(1),
            xs: st.boxShadow === xsShadow,
            got: st.boxShadow,
          });
        }
        /* Batch A's border weights. The widest side, not the top one: several entries carry their
           border on a single edge (`.goal-form-header` is a bottom rule, `.goal-form-actions` a top
           one), so a top-only read would report 0 for them and pass every assertion by accident. */
        out.p5 = P5_SELECTORS.map((sel) => {
          const st = getComputedStyle(build(sel, probe));
          return {
            sel,
            bw: +Math.max(
              parseFloat(st.borderTopWidth),
              parseFloat(st.borderRightWidth),
              parseFloat(st.borderBottomWidth),
              parseFloat(st.borderLeftWidth),
            ).toFixed(1),
          };
        });
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
          const br = badge.getBoundingClientRect();
          /* Probed rather than pattern-matched, for the reason `shadowOf` exists at all: the
             two literals this used to test for (/^1.5px 1.5px/ and /^2px 2px/) are the doodle
             offsets, so every Atlas pass failed both branches below -- 45 findings about a
             step-down that was working. What the assertion is actually about is "mobile takes
             the xs step, desktop takes the full one", and that is the same claim in both skins
             once it is written against the tokens instead of against doodle's values. */
          out.hdr = {
            card: parseFloat(hs.borderTopWidth) >= 1 && hs.boxShadow !== "none" && parseFloat(hs.paddingTop) > 0,
            xs: hs.boxShadow === xsShadow,
            base: hs.boxShadow === shadowOf("--shadow-doodle"),
            got: hs.boxShadow,
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
            // What the paper is supposed to be: the mood's own tint, identical on every note.
            wantPaper: wantPaper(14),
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

        /* ---- tasks page: where do I add a task, and where a course? ----
           The complaint was that on a phone you cannot tell, and the two halves of the answer are
           both invisible to a stylesheet read.

           "New Course" was the last item of an `overflow-x: auto` scroller, so with a handful of
           courses it was off-screen -- and off-screen inside a scroller is not a clip the sweep
           above can see, because a scroller is *meant* to be wider than its box. What can be
           measured is the thing that made it reachable: the button is not inside the scroller at
           all, its box is inside the ribbon's, and below the breakpoint it sits on its own line
           under the chips rather than sharing theirs.

           The two captions are the other half, and their whole job is to be on screen: a caption
           that renders at zero height, or that leaks onto the desktop layout, is exactly the
           failure a rule reviewed by eye passes. */
        const ribbon = document.querySelector("#fx-tabs .subjects-ribbon");
        const addChip = ribbon?.querySelector(".subject-add-chip");
        const scroller = ribbon?.querySelector(".subjects-scroll");
        const captions = [
          ribbon?.querySelector(".notebook-zone-label"),
          document.querySelector("#fx-taskrow .notebook-zone-label"),
        ];
        if (ribbon && addChip && scroller && captions.every(Boolean)) {
          const rr = ribbon.getBoundingClientRect();
          const ar = addChip.getBoundingClientRect();
          const sr = scroller.getBoundingClientRect();
          // The header's "Detailed Form": a task control sitting above the labelled task zone, so
          // below the breakpoint it is demoted out of the filled tier and has to come back into it
          // above -- the one property of this pass that is a variant swap rather than a layout.
          const detailed = document.querySelector("#fx-tabs .header-actions .btn-secondary");
          out.addFlow = {
            inScroller: scroller.contains(addChip),
            // Both edges, because in RTL an over-wide button hangs off the inline-start one and a
            // single-edge test reads as a pass.
            outside: Math.max(Math.round(ar.right - rr.right), Math.round(rr.left - ar.left)),
            ownLine: Math.round(ar.top) >= Math.round(sr.bottom),
            capH: captions.map((c) => Math.round(c.getBoundingClientRect().height)),
            capShown: captions.map((c) => getComputedStyle(c).display !== "none"),
            detailedOutline: detailed
              ? getComputedStyle(detailed).borderTopStyle === "dashed" &&
                /(,|\/)\s*0\)$/.test(getComputedStyle(detailed).backgroundColor)
              : null,
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
              // `display` is read first because Atlas hides these pen lines rather than
              // restyling them: the border declarations survive on a box that is never
              // generated, so a predicate built only from border style and width reports a
              // dashed ink line on a glass panel that visibly has none.
              return (
                r.display === "none" ||
                r.borderTopStyle !== "dashed" ||
                !(parseFloat(r.borderTopWidth) > 0) ||
                getComputedStyle(el).position === "static"
              );
            }),
            cardPapers: dcards.map((c) => getComputedStyle(c).backgroundColor),
            wantCardPaper: wantPaper(12),
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
            // The heat cells are the one place on this page where the radius is a hand-drawn
            // two-axis literal rather than a --radius-doodle-* token, so it is the one radius the
            // skin remap cannot reach and the only one an atlas rule has to restate.
            cellCorners: [
              "borderTopLeftRadius",
              "borderTopRightRadius",
              "borderBottomRightRadius",
              "borderBottomLeftRadius",
            ].map((p) => getComputedStyle(anaHeat)[p]),
            ringsMissing: FRAMES.filter((sel) => {
              const el = anaRoot.querySelector(sel);
              if (!el) return true;
              const r = getComputedStyle(el, "::after");
              return (
                r.display === "none" ||
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
          /* The tiles, not the columns, for the layout questions below: what a reader sees is
             where the cards are, and the wrapper is only ever a means to that. */
          const tiles = [...dgrid.querySelectorAll(":scope > section > *")];
          const tileRects = tiles.map((t) => t.getBoundingClientRect());
          const art = dash.querySelector(".dashboard-hero-art");
          const heroCard = dash.querySelector(".dashboard-hero-card");
          out.dash = {
            skin: document.documentElement.dataset.skin,
            // Against the column it was handed, not the viewport: a grid that overflows its own
            // parent is the fault, and it is measurable before anything reaches the page edge.
            gridOver: Math.round(gr.width - parentW),
            // One column below 960px, two above it.
            colTops: new Set(cols.map((c) => Math.round(c.getBoundingClientRect().top))).size,
            colCount: cols.length,
            // How many distinct inline start edges the tiles occupy: one when the layout is
            // stacked, two when it is side by side. Works for both skins because it reads the
            // tiles' own boxes -- the doodle flex columns and the atlas grid tracks put their
            // tiles in the same two places, and that shared fact is what is worth asserting.
            tileCols: new Set(tileRects.map((r) => Math.round(r.left))).size,
            tileCount: tiles.length,
            // Both skins arrange the page with two real column boxes; nothing here should ever
            // read `contents` again, and the reason is `stackGaps` below.
            colDisplay: cols.map((c) => getComputedStyle(c).display),
            /* The reported defect, measured. Atlas used to make the wrappers `display: contents`,
               which promoted the four cards to grid items of a 12-track grid -- and grid items
               line up in ROWS, so a short right-hand card sat in a row sized by its tall
               left-hand neighbour and floated at the top of it with ~170px of dead air below.
               Every other measurement in this probe passed while that was true: the tiles were
               in two columns, the tracks were right, nothing overflowed.
               What separates the two layouts is the vertical distance between consecutive cards
               in the SAME column. It has to be the column's own gutter and nothing else. Read
               `want` off the element instead of hardcoding 16 or 24, so the check states "these
               cards sit one gutter apart" for either skin at either breakpoint rather than
               restating the token values and drifting from them. */
            stackGaps: cols.map((c) => {
              const rs = [...c.children]
                .map((k) => k.getBoundingClientRect())
                .sort((a, b) => a.top - b.top);
              return {
                want: Math.round(parseFloat(getComputedStyle(c).rowGap) || 0),
                got: rs.slice(1).map((r, i) => Math.round(r.top - rs[i].bottom)),
              };
            }),
            gridTracks: getComputedStyle(dgrid).gridTemplateColumns.split(/\s+/).length,
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
            /* The hero artwork. Deliberately absent from SECTIONS above, for the same reason
               `.plan-note-watermark` is: it is placed with a negative inline inset so that it
               bleeds off the card's trailing edge, which is the effect, and a sweep that reports
               every element wider than its box would call that a defect at every width.
               What is worth asserting instead is the pair of claims the CSS actually makes --
               that the bleed is contained by the hero's own `overflow: hidden` rather than
               reaching the page, and that the art is gone on a phone where there is no room for
               it beside the headline. Both are recorded here and checked below. */
            art: art
              ? {
                  shown: getComputedStyle(art).display !== "none",
                  heroClips: heroCard ? getComputedStyle(heroCard).overflowX : "",
                }
              : null,
            /* The generative goal ring. A pseudo-element, so nothing above can see it: it is not
               in `querySelectorAll`, it has no rect of its own to sweep, and every one of the
               ways it can fail is silent. `--goal-pct` is set inline in dashboard/page.tsx as a
               bare number, and the arc is `conic-gradient(var(--primary) calc(var(--goal-pct) *
               1%), ...)`. If the property is missing, `calc()` falls back to 0 and the ring is an
               empty track that looks like a deliberately unstarted goal. If the number arrived as
               "13%" instead, `calc(13% * 1%)` is invalid, the whole gradient is dropped, and
               `backgroundImage` reads `none` -- a ring that is simply not there. Both read as
               design rather than as a bug, which is exactly what a regression test is for. */
            ring: (() => {
              const goal = dash.querySelector(".goal-item-card");
              if (!goal) return null;
              const ps = getComputedStyle(goal, "::before");
              return {
                pct: getComputedStyle(goal).getPropertyValue("--goal-pct").trim(),
                w: Math.round(parseFloat(ps.width) || 0),
                h: Math.round(parseFloat(ps.height) || 0),
                arc: ps.backgroundImage.startsWith("conic-gradient"),
                // The hole. Without a mask the ring is a filled pie, which is a different chart.
                masked: (ps.maskImage || ps.webkitMaskImage || "none") !== "none",
                content: ps.content,
              };
            })(),
            /* The week curve. Two layers over one coordinate space, which is exactly the thing
               that can silently come apart: the SVG stretches to fill `.week-chart-plot` while the
               dots are placed at `top: calc(var(--y) * 1%)` of that same box, so if the plot's
               height stops being definite the dots collapse to its top edge while the curve keeps
               drawing correctly -- a graph with its markers in a row along the ceiling, and no
               error anywhere. Measuring one dot's real offset against the `--y` it was given is
               what catches that, and it also catches a fixture whose hand-copied path has drifted
               from the component's arithmetic.

               The rest is the mood claim the redesign is actually for: the line's gradient stops
               have to resolve to this run's `--primary` and `--accent`. A chart that fell back to
               a hardcoded colour would look perfectly fine in one palette and wrong in four. */
            week: (() => {
              const chart = dash.querySelector(".week-chart");
              const plot = chart?.querySelector(".week-chart-plot");
              const axis = chart?.querySelector(".week-chart-axis");
              const line = chart?.querySelector(".week-chart-line");
              if (!chart || !plot || !axis || !line) return null;
              const pr = plot.getBoundingClientRect();
              const dots = [...plot.querySelectorAll(".week-chart-dot")];
              const stop = (sel) => {
                const el = chart.querySelector(sel);
                return el ? getComputedStyle(el).stopColor : "";
              };
              const rootStyle = getComputedStyle(document.documentElement);
              // Resolved through a throwaway node rather than compared as raw token text: the
              // stops report `rgb(...)` and the custom property reports whatever was authored.
              const swatch = document.createElement("span");
              swatch.style.cssText = "position:absolute;left:-9999px";
              document.body.appendChild(swatch);
              const resolve = (token) => {
                swatch.style.color = `var(${token})`;
                return getComputedStyle(swatch).color;
              };
              const out = {
                days: axis.querySelectorAll(":scope > li").length,
                tracks: getComputedStyle(axis).gridTemplateColumns.split(/\s+/).length,
                plotH: Math.round(pr.height),
                // A `d` the browser could not parse leaves a path of zero length, which renders as
                // nothing at all -- the one failure that looks like an empty week.
                lineLen: Math.round(line.getTotalLength()),
                svgFills:
                  Math.round(chart.querySelector(".week-chart-svg").getBoundingClientRect().height) > 0,
                dots: dots.length,
                // The dot nearest the top, checked against where it was told to be. Vertical only:
                // the horizontal axis is mirrored in RTL and its own alignment is the axis grid's.
                topDot: (() => {
                  const best = dots.reduce(
                    (acc, el) => {
                      const want = +getComputedStyle(el).getPropertyValue("--y").trim();
                      return want < acc.want ? { want, el } : acc;
                    },
                    { want: Infinity, el: null },
                  );
                  if (!best.el) return null;
                  const r = best.el.getBoundingClientRect();
                  return {
                    want: best.want,
                    // Centre of the dot as a percentage down the plot's content box. `translate`
                    // already centres it on the point, so the centre is the number to compare.
                    got: Math.round(((r.top + r.height / 2 - pr.top) / pr.height) * 1000) / 10,
                  };
                })(),
                lineFrom: stop(".week-chart-line-from"),
                lineTo: stop(".week-chart-line-to"),
                areaFrom: stop(".week-chart-area-from"),
                wantPrimary: resolve("--primary"),
                wantAccent: resolve("--accent"),
                // The plot is padded under atlas and not under doodle, so the comparison above has
                // to be against the content box either way -- recorded so the log can show it.
                pad: Math.round(parseFloat(getComputedStyle(plot).paddingTop) || 0),
                gridInk: getComputedStyle(chart.querySelector(".week-chart-axis-line")).stroke,
                mirrored: getComputedStyle(chart.querySelector(".week-chart-svg")).scale,
                dir: rootStyle.direction,
              };
              swatch.remove();
              return out;
            })(),
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

        // ---- Phase 5, Batch B: pastel cycle, family marks, forum tilt ----
        /* Three claims a stylesheet read cannot settle. (a) The goal tiles' fixed
           nth-child pastel rotation is mood-blind by construction -- the same fault class as the
           always-green task paper -- so atlas must collapse it to one uniform raised-glass tier,
           while doodle must keep all four pastels. Both halves asserted, neither skippable.
           (b) The Batch B card-family members carry hand-drawn corner marks as background-images;
           doodle keeps them, atlas drops them, exactly like .dashboard-card in Phase 3. A
           background: shorthand creeping into an atlas rule would pass a "marks absent" test on
           atlas while silently wiping them from doodle -- which is why the doodle half is measured
           too. (c) The plan board's nth-child tilt is the pinboard again: doodle keeps it on
           desktop (the mobile block zeroes it), atlas has it at no width. */
        const goalRoot = document.getElementById("fx-goalcards");
        if (goalRoot) {
          out.batchB = {
            goalPapers: [...goalRoot.querySelectorAll(".goal-card")].map(
              (c) => getComputedStyle(c).backgroundColor,
            ),
            wantRaisedGlass: resolveBg("var(--glass-bg-raised)"),
            marks: [
              ...document.querySelectorAll("#fx-challenges .challenge-list-card, #fx-social .friend-card"),
            ].map((c) => getComputedStyle(c).backgroundImage),
            planTilted: [...document.querySelectorAll("#fx-planboard .plan-day-note")].filter((n) => {
              const m = new DOMMatrixReadOnly(getComputedStyle(n).transform);
              return Math.abs(m.b) > 0.001 || Math.abs(m.c) > 0.001;
            }).length,
            // Exactly one event per kind, selected by class -- the month grid holds five events
            // across three kinds, so a blanket query would miscount. The inline-START colour,
            // read logically so the RTL run asserts the same thing the LTR one does.
            calSpines: ["task", "session", "plan"].map((k) => {
              const el = document.querySelector(`#fx-calendar .calendar-event.${k}`);
              return el ? getComputedStyle(el).borderInlineStartColor : "missing";
            }),
            wantSpineTokens: ["--primary", "--accent", "--warning"].map((t) => resolveBg(`var(${t})`)),
            // The ghost button's border stays TRANSPARENT under both skins -- the atlas rule
            // excludes it by :not(), and this is what proves the exclusion held.
            ghostInk: getComputedStyle(document.querySelector(".btn.btn-ghost")).borderTopColor,
          };
        }

        return out;
      },
      { SECTIONS, TAP, DECO_SELECTORS, P5_SELECTORS },
    );

    const tag = `${skin}/${mood} ${w}x${h}${mobile ? " coarse" : ""}${dir === "rtl" ? " rtl" : ""}`;
    const navBad = res.nav ? res.nav.overlap > 0 || res.nav.wasted > 0 : false;
    // Below the breakpoint every listed card must drop to the xs shadow and a sub-2px
    // border. Nothing is asserted above it: `@media (max-width: 768px)` structurally
    // cannot apply at 1440px, and several of these cards already ship an xs shadow at
    // full size, so "desktop must not look thinned" is not expressible as one value.
    const decoBad = w <= 768 ? (res.deco ?? []).filter((d) => !d.xs || d.bw > 1.5) : [];
    if (!res.deco?.length) throw new Error("decoration probe matched no cards -- fixture drifted");
    /* Phase 5, Batch A border weights, per skin. See P5_SELECTORS for why the thresholds are 2 and 1
       and why nothing in that list is a comfort-block member. */
    if (!res.p5?.length) throw new Error("Batch A border probe matched nothing -- P5_SELECTORS is empty");
    const p5Bad = res.p5.filter((d) => (skin === "doodle" ? d.bw < 2 : d.bw > 1));
    // 28.8px is the 1.8rem clamp floor. The plan proposed 1.6rem, which would have made
    // 360px smaller than it already was -- the opposite of "never looks squeezed" -- so the
    // floor stayed and only the ramp got faster. Asserted here so it cannot drift back down.
    if (!res.hdr) throw new Error("page-header probe found nothing -- fixture drifted");
    const hdrBad = [];
    if (!res.hdr.card) hdrBad.push("header is not rendering as a bordered, padded card");
    if (res.hdr.h1 < 28.8) hdrBad.push(`h1 is ${res.hdr.h1}px, below the 28.8px floor`);
    if (res.hdr.badgeW < res.hdr.badgeH) hdrBad.push(`icon badge squeezed to ${res.hdr.badgeW}x${res.hdr.badgeH}`);
    if (w <= 768 && !res.hdr.xs)
      hdrBad.push(`mobile header shadow did not step down to xs -- expected "${res.xsShadow}", got "${res.hdr.got}"`);
    if (w > 768 && !res.hdr.base)
      hdrBad.push(`desktop header shadow is not the full-size one -- got "${res.hdr.got}"`);
    if (!res.task) throw new Error("tasks notebook probe found nothing -- fixture drifted");
    const taskBad = [];
    /* Tilt and tape are the pinboard, and the two skins disagree about it in a way that has to be
       stated separately or one skin's intent gets reported as the other's defect. Doodle: a
       pinboard on a desktop, flattened below 768px where cards are already in one column. Atlas:
       no pinboard at any width -- a rotated glass panel reads as a rendering error, not as paper.
       The `::before` survives into Atlas but is no longer tape: it is the course-coloured top
       edge, and a single-column phone is where a course colour is most useful, not least, so it
       is asserted present at every width rather than absent below the breakpoint. */
    if (skin === "atlas") {
      if (res.task.tilted) taskBad.push("an atlas note still carries the doodle pinboard tilt");
      if (!res.task.tape) taskBad.push("the atlas course edge is not drawn on the note");
    } else if (w <= 768) {
      if (res.task.tilted) taskBad.push("a task card still carries the pinboard tilt");
      if (res.task.tape) taskBad.push("the sticky-note tape strip is still rendered");
    } else {
      if (!res.task.tilted) taskBad.push("desktop lost the pinboard tilt");
      if (!res.task.tape) taskBad.push("desktop lost the sticky-note tape");
    }
    if (w <= 768) {
      if (res.task.minH > 0) taskBad.push(`card min-height is still ${res.task.minH}px`);
      if (res.task.bodyMinH > 0) taskBad.push(`card body min-height is still ${res.task.bodyMinH}px`);
      if (res.task.manageOff !== "none") taskBad.push("manage row is visible with data-manage=off");
      if (res.task.manageOn === "none") taskBad.push("manage row is hidden with data-manage=on");
      if (!res.task.optsHidden) taskBad.push("quick-add selects are visible with data-options=off");
      if (!res.task.oneLine) taskBad.push("quick-add input and submit are not on the same line");
      if (res.task.submitH < 44) taskBad.push(`quick-add submit is ${res.task.submitH}px tall, under the 44px row`);
      // The row is [input][options 44][add 74] plus two 8px gaps and 2x16px of card padding, so
      // the input gets `viewport - 208`: 112px at 320px, 152px at 360px. The decorative pen used
      // to be in that sum and is now dropped for the whole mobile range, which is where the 40px
      // came from -- 320px was the width that only just cleared this before.
      if (res.task.inputW < 110) taskBad.push(`quick-add input squeezed to ${res.task.inputW}px`);
    } else {
      // Above the breakpoint every one of those is the opposite: the pinboard is the design.
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
    /* Inverted from what this used to claim, and the inversion is the fix. It used to demand that
       two courses paint two different papers -- which is exactly how every note ended up green in
       a pink mood, because the paper was mixed from the course colour. The paper is the mood now:
       one value across every note, and that value has to be the mood's own tint rather than any
       stale hardcoded green, so both halves are stated. Course identity did not disappear, it
       moved to the things that are only ever the course -- the subject tag, the watermark glyph
       and the top edge -- and the tag is still checked for two distinct fills below. */
    if (distinct(res.task.papers) !== 1)
      taskBad.push(
        `two courses painted ${distinct(res.task.papers)} papers (${res.task.papers.join(" / ")}) -- the paper is the mood, not the course`,
      );
    else if (norm(res.task.papers[0]) !== norm(res.task.wantPaper))
      taskBad.push(`note paper is ${res.task.papers[0]}, not the mood's own ${res.task.wantPaper}`);
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

    /* The two add flows. Reachability holds at every width -- a "New Course" button that went back
       inside the scroller is the original defect at any size -- while the line it sits on and the
       captions are the mobile half of the answer, and both have to reverse above the breakpoint. */
    if (!res.addFlow) throw new Error("tasks add-flow probe found nothing -- fixture drifted");
    if (res.addFlow.inScroller)
      taskBad.push("New Course is back inside .subjects-scroll, where it scrolls out of reach");
    if (res.addFlow.outside > 0)
      taskBad.push(`New Course hangs ${res.addFlow.outside}px outside the ribbon${dir === "rtl" ? " (RTL flip)" : ""}`);
    if (w <= 768) {
      if (!res.addFlow.ownLine) taskBad.push("New Course is sharing the chips' line instead of taking its own");
      if (res.addFlow.capShown.some((s) => !s)) taskBad.push("a zone caption is hidden below the breakpoint");
      const flat = res.addFlow.capH.findIndex((h) => h < 16);
      if (flat >= 0) taskBad.push(`zone caption ${flat + 1} rendered ${res.addFlow.capH[flat]}px tall`);
      if (res.addFlow.detailedOutline === false)
        taskBad.push("the header's Detailed Form button is still in the filled tier on mobile");
    } else {
      if (res.addFlow.capShown.some(Boolean)) taskBad.push("a zone caption leaked onto the desktop layout");
      if (res.addFlow.detailedOutline) taskBad.push("desktop lost the filled Detailed Form button");
    }

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
    /* --font-label opens with var(--font-jakarta), which the fixture sets to "Plus Jakarta Sans"; a
       computed family that contains it proves the label chain resolved and reached the element.
       (Was "IBM Plex Sans" before the app moved off it -- Plex's variable wght axis stops at 700,
       so every `font-weight: 800` in the stylesheets was clamping. Before that, "Delius Swash
       Caps", back when the app used the hand-lettered pair.) */
    const LABEL_FACE = "Plus Jakarta Sans";
    // Four different corner strings is the definition being asserted; three is the tolerance for
    // a shape that happens to repeat one pair, and one means somebody wrote a single radius.
    const wobbly = (c) => new Set(c).size >= 3 && !c.some((v) => v.includes("9999px"));
    /* ...and the Atlas inverse, because the wobble is a doodle signature. The skin block in
       tokens.css collapses --radius-doodle* to one bento radius deliberately, so asserting four
       different corners on an Atlas run reports the redesign itself as a defect -- which it did,
       on all 30 of them. Rather than skip the check on the new skin, invert it: "one radius"
       is exactly as falsifiable as "four different ones", and it still catches a hardcoded
       doodle radius that the token remap cannot reach surviving into Atlas.

       The two elements want different things from that radius, so they are not one predicate.
       A chip going to a true pill (--radius-doodle-chip becomes --radius-full) is the intent;
       a card going to a pill is a mistake, which is why only the card rules 9999px out. */
    const uniform = (c) => new Set(c).size === 1;
    const doodleSkin = skin === "doodle";
    const chipOk = doodleSkin ? wobbly(res.doodle.chipCorners) : uniform(res.doodle.chipCorners);
    const cardOk = doodleSkin
      ? wobbly(res.doodle.cardCorners)
      : uniform(res.doodle.cardCorners) && !res.doodle.cardCorners[0].includes("9999px");
    const want = doodleSkin ? "hand-drawn (3+ distinct corners)" : "one uniform radius";
    if (!chipOk) doodleBad.push(`course chip corners are not ${want}: ${res.doodle.chipCorners.join(" | ")}`);
    if (!cardOk)
      doodleBad.push(`dashboard task card corners are not ${want}: ${res.doodle.cardCorners.join(" | ")}`);
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
      if (!fam.includes(LABEL_FACE)) doodleBad.push(`${what} did not resolve to the label face (${fam})`);
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
    /* The inner pen line is doodle's frame, and Atlas replaces it with a hairline rim on the
       element itself -- so "the line is there" and "the line is gone" are both real requirements,
       one per skin. Asserting only the doodle half would let Atlas keep drawing ink inside glass;
       skipping the check on Atlas would let a doodle regression through unnoticed. */
    if (doodleSkin) {
      if (res.doodle.ringsMissing.length)
        doodleBad.push(`no inner pen line on ${res.doodle.ringsMissing.join(", ")}`);
    } else if (res.doodle.ringsMissing.length !== 3) {
      doodleBad.push(
        `${3 - res.doodle.ringsMissing.length} of the 3 notebook frames still draw the doodle pen line under atlas`,
      );
    }
    if (res.doodle.cardPapers.some(dead))
      doodleBad.push(`a dashboard task card has no paper at all (${res.doodle.cardPapers.join(" / ")})`);
    /* Same inversion as the sticky notes: three courses, one paper, and that paper has to be the
       mood's tint. The spine below is where the three courses are still told apart. */
    if (distinct(res.doodle.cardPapers) !== 1)
      doodleBad.push(
        `three courses painted ${distinct(res.doodle.cardPapers)} papers on the dashboard (${res.doodle.cardPapers.join(" / ")}) -- the paper is the mood`,
      );
    else if (norm(res.doodle.cardPapers[0]) !== norm(res.doodle.wantCardPaper))
      doodleBad.push(
        `dashboard card paper is ${res.doodle.cardPapers[0]}, not the mood's own ${res.doodle.wantCardPaper}`,
      );
    if (res.doodle.cardSpines.some(dead)) doodleBad.push("a dashboard card spine has no colour");
    if (distinct(res.doodle.cardSpines) < 3)
      doodleBad.push(`three courses drew ${distinct(res.doodle.cardSpines)} spines on the dashboard`);
    // The alternating tilt is the pinboard again: all three under doodle, none under atlas.
    if (res.doodle.cardTilted !== (doodleSkin ? 3 : 0))
      doodleBad.push(
        `${res.doodle.cardTilted}/3 dashboard cards are tilted, expected ${doodleSkin ? "3 (the doodle pinboard)" : "0 (atlas has no pinboard)"}`,
      );
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
    /* Both frames, per skin. Doodle draws 2.5px of ink; atlas replaces it with a 1px rim, so
       "thicker than 2px" and "no thicker than 1px" are both real requirements and each is the other's
       regression test. Asserting only the doodle half would let an atlas rule keep the ink; skipping
       the check under atlas would let a doodle regression through.

       Doodle is checked above the breakpoint only: all three of `.analytics-panel`,
       `.analytics-wide-panel` and `.analytics-ai-panel` are in the mobile comfort block, which thins
       the border to 1.5px at <=768px -- and decoBad above already asserts that thinning from the
       other side. Atlas is checked at every width, because 1px is what it declares and what the
       comfort block hands it.

       2, not 2.5, because Chromium floors border-width to whole CSS pixels in the used value: the
       2.5px the family declares is reported as 2px and the comfort block's 1.5px as 1px. The
       stylesheet is right; this is the number that is measurable. Same reason decoBad's ceiling is
       1.5 rather than 1. */
    if (doodleSkin) {
      if (w > 768) {
        if (ana.panelBorder < 2) analyticsBad.push(`panel border is ${ana.panelBorder}px, not the 2.5px every other card carries`);
        if (ana.aiBorder < 2) analyticsBad.push(`AI panel border is ${ana.aiBorder}px, not 2.5px`);
      }
    } else {
      if (ana.panelBorder > 1) analyticsBad.push(`panel border is ${ana.panelBorder}px under atlas, not a 1px rim`);
      if (ana.aiBorder > 1) analyticsBad.push(`AI panel border is ${ana.aiBorder}px under atlas, not a 1px rim`);
    }
    /* The corner marks are a `background-image`, at every width, which is the whole reason these
       panels had to move from the `background:` shorthand to `background-color:` before they could
       join the card family. A shorthand added back anywhere -- base rule, mood override, media
       query -- silently resets this to `none` and nothing else in the file would notice.

       Inverted for atlas rather than skipped. The marks are three baked-in hex literals per panel
       (#38BDF8/#FBBF24/#F472B6, and #263D5B/#F59E0B/#EC4899 in the cosmic twin), i.e. mood-blind ink,
       which is the fault class Phase 4 spent its time removing from the task papers and the charts --
       so Batch A drops them under atlas, the same call `.dashboard-card` in this family already made.
       Stating it as `=== "none"` keeps that a measured decision instead of an untested one: a
       `background:` shorthand creeping back into an atlas rule would pass this, but a *doodle* rule
       losing its marks still fails above, and an atlas rule quietly re-inheriting them fails here. */
    if (doodleSkin) {
      if (ana.panelMarks === "none") analyticsBad.push("panel lost its corner marks (background-image: none)");
      if (ana.aiMarks === "none") analyticsBad.push("AI panel lost its inverted corner marks");
    } else {
      if (ana.panelMarks !== "none") analyticsBad.push(`the panel still paints hand-drawn corner marks under atlas (${ana.panelMarks})`);
      if (ana.aiMarks !== "none") analyticsBad.push(`the AI panel still paints hand-drawn corner marks under atlas (${ana.aiMarks})`);
    }
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
    /* Same inversion as the three notebook frames: the second pen line is doodle's frame and atlas
       replaces it with the rim on the element itself, so "both lines are there" and "both lines are
       gone" are one requirement each. `FRAMES` is the two wide panels, and each declares its own
       `position: relative`, so either can lose its line alone. */
    if (doodleSkin) {
      if (ana.ringsMissing.length) analyticsBad.push(`no second pen line on ${ana.ringsMissing.join(", ")}`);
    } else if (ana.ringsMissing.length !== 2) {
      analyticsBad.push(
        `${2 - ana.ringsMissing.length} of the 2 analytics frames still draw the doodle pen line under atlas`,
      );
    }
    /* The heat cell's radius is the only hand-drawn *literal* on this page -- `4px 2px 5px 2px /
       2px 5px 2px 4px` rather than a --radius-doodle-* token -- which makes it the only radius the
       skin's token remap cannot reach. So it is also the only one that fails silently: every other
       corner on the page follows the skin for free, and this one would keep wobbling under atlas
       with nothing to say so. */
    const cellOk = doodleSkin ? wobbly(ana.cellCorners) : uniform(ana.cellCorners);
    if (!cellOk)
      analyticsBad.push(
        `heat cell corners are ${ana.cellCorners.join(" / ")}, expected ${doodleSkin ? "hand-drawn (3+ distinct corners)" : "one uniform radius"}`,
      );
    /* ---- Phase 5, Batch B assertions ---- */
    if (!res.batchB) throw new Error("Batch B probe found nothing -- fixture drifted");
    const batchBBad = [];
    {
      const gDistinct = distinct(res.batchB.goalPapers);
      if (doodleSkin) {
        // Four tiles, four pastels -- the cycle is doodle's design and must survive untouched.
        if (gDistinct < 4)
          batchBBad.push(`the goal pastel cycle collapsed to ${gDistinct} colours under doodle`);
      } else {
        // The fixed pastel rotation is mood-blind; atlas replaces it with one raised-glass tier.
        if (gDistinct !== 1)
          batchBBad.push(
            `goal cards painted ${gDistinct} papers under atlas (${res.batchB.goalPapers.join(" / ")}) -- the mood-blind pastel cycle survived`,
          );
        else if (norm(res.batchB.goalPapers[0]) !== norm(res.batchB.wantRaisedGlass))
          batchBBad.push(
            `atlas goal cards are ${res.batchB.goalPapers[0]}, not the raised glass tier (${res.batchB.wantRaisedGlass})`,
          );
        if (res.batchB.planTilted)
          batchBBad.push(
            `${res.batchB.planTilted} plan note(s) still carry the doodle pinboard tilt under atlas`,
          );
      }
      for (const m of res.batchB.marks) {
        if (doodleSkin && m === "none")
          batchBBad.push("a family card lost its corner marks under doodle");
        if (!doodleSkin && m !== "none")
          batchBBad.push(`a family card still paints hand-drawn corner marks under atlas (${m})`);
      }
      // Three kinds, three spine colours -- asserted against the tokens each kind names rather
      // than against each other, because task (--primary) and session (--accent) are the SAME
      // hex in notebook and cosmic by design (the tokens.css note): a distinctness check would
      // fail those two moods forever while proving nothing about the other three. Token
      // equality is stricter anyway: it catches a rim-grey repaint (the Batch A tie bug) AND a
      // wrong-token regression, in every mood.
      if (res.batchB.calSpines.length !== 3)
        batchBBad.push(`expected task/session/plan events in the fixture, found ${res.batchB.calSpines.length}`);
      else {
        const kinds = ["task", "session", "plan"];
        for (const [i, got] of res.batchB.calSpines.entries()) {
          const want = res.batchB.wantSpineTokens[i];
          if (dead(got) || norm(got) !== norm(want))
            batchBBad.push(
              `the ${kinds[i]} event spine is ${got}, not its own token (${want})`,
            );
        }
      }
      // The ghost must stay borderless under atlas: its ink is transparent by design, and the
      // global button rule deliberately excludes it.
      if (!dead(res.batchB.ghostInk))
        batchBBad.push(`the ghost button's border is ${res.batchB.ghostInk}, not transparent`);
    }
    /* Keyed by skin AND mood, so the RTL run overwrites its own LTR twin rather than a
       different palette -- and so the doodle regression runs do not overwrite the atlas
       measurements for the moods they share. Keying by mood alone silently reduced this to
       whichever skin happened to run last in RUNS. */
    CHART_INK[`${skin}/${mood}`] = { tip: ana.tipInk, heat: ana.heatInk, cta: ana.ctaFill, signal: ana.toneInks[0] };

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
    if (res.dash.tileCount !== 4)
      dashBad.push(`expected four dashboard tiles in the fixture, found ${res.dash.tileCount}`);
    if (res.dash.gridOver > 1)
      dashBad.push(`the layout grid is ${res.dash.gridOver}px wider than the page column it sits in`);
    if (res.dash.tileHidden > 1)
      dashBad.push(`the stat tiles hide ${res.dash.tileHidden}px of themselves`);
    // One column below 960px, side by side above it. The single-column case is where the overflow
    // lived, because every row then shares one track: the left column's header set the width the
    // right column's tiles were cut to.
    const wantStacked = w <= 960;
    /* Asserted on the tiles rather than the wrappers, because a wrapper can be in the right place
       while the card inside it is not: distinct inline start edges is a statement about what a
       reader actually sees -- one edge when stacked, two when side by side -- and it holds for
       either skin's track sizing. */
    if (res.dash.tileCols !== (wantStacked ? 1 : 2))
      dashBad.push(
        `the dashboard tiles occupy ${res.dash.tileCols} column(s) at ${w}px, expected ${wantStacked ? 1 : 2}`,
      );
    /* "Close to each other and organized", stated as a measurement. Checked for both skins and
       at every width, because the failure it catches -- a card positioned by the height of the
       other column's card instead of by the card above it -- is invisible to every other
       assertion here. */
    for (const [i, s] of res.dash.stackGaps.entries()) {
      const off = s.got.filter((g) => Math.abs(g - s.want) > 2);
      if (off.length)
        dashBad.push(
          `dashboard column ${i + 1} leaves ${off.join("/")}px between its stacked cards at ${w}px, not the ${s.want}px gutter -- they are floating, not stacked`,
        );
    }
    if (res.dash.skin === "atlas") {
      /* The mechanism behind the gap check above. Two real column boxes are what make each stack
         pack independently of the other one's heights; if a later rule puts these wrappers back
         to `display: contents` the cards become grid items again and the rows re-lock. `tileCols`
         above cannot see that -- it reads 2 in both layouts. */
      for (const [i, d] of res.dash.colDisplay.entries()) {
        if (d !== "flex")
          dashBad.push(`atlas dashboard column ${i + 1} is display: ${d}, expected flex`);
      }
      const wantTracks = wantStacked ? 1 : 2;
      if (res.dash.gridTracks !== wantTracks)
        dashBad.push(
          `the atlas bento has ${res.dash.gridTracks} column track(s) at ${w}px, expected ${wantTracks}`,
        );
    } else {
      // The doodle skin keeps real block columns, so its own wrappers are the thing to measure
      // and their rects are well defined.
      if ((res.dash.colTops === 2) !== wantStacked)
        dashBad.push(
          `the columns are ${res.dash.colTops === 2 ? "stacked" : "side by side"} at ${w}px, expected the ${wantStacked ? "stacked" : "side by side"} layout`,
        );
    }
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
    /* The hero artwork, both halves of its contract. It is in the DOM for both skins and shown
       for one, so "is it displayed" is a two-sided assertion rather than a presence check: the
       doodle skin already fills that corner with its own ambient doodles and a second drawing
       over them is noise, and below 960px the headline needs the whole card. */
    if (!res.dash.art) {
      dashBad.push("the hero artwork is missing from the dashboard fixture");
    } else {
      const wantArt = res.dash.skin === "atlas" && w > 960;
      if (res.dash.art.shown !== wantArt)
        dashBad.push(
          `the hero artwork is ${res.dash.art.shown ? "shown" : "hidden"} on ${res.dash.skin} at ${w}px, expected it ${wantArt ? "shown" : "hidden"}`,
        );
      // The bleed has to be contained by the hero, not by luck. `overflow: hidden` on the card is
      // the only thing between a -2rem inline inset and a page-wide horizontal scrollbar -- and it
      // is the *only* thing asserted here. The card's own `scrollWidth` still reports the bleed,
      // because a clipped overflow region is programmatically scrollable even when the user cannot
      // reach it, so a `scrollWidth > clientWidth` check on the hero would report ~14px of
      // deliberate decoration as a defect at every desktop width. That the bleed reaches nothing
      // is covered where it matters instead: `res.doc` measures the document's own overflow.
      if (res.dash.art.heroClips === "visible")
        dashBad.push("the hero card does not clip, so the artwork's bleed reaches the page");
    }
    /* The goal ring. Only the atlas skin draws one -- doodle keeps its bar, and asserting the
       pseudo-element is absent there is what stops the ring from leaking out of the skin. */
    if (!res.dash.ring) {
      dashBad.push("no .goal-item-card in the dashboard fixture");
    } else if (res.dash.skin === "atlas") {
      if (res.dash.ring.content === "none")
        dashBad.push("the atlas goal ring's ::before is not generated");
      if (!res.dash.ring.arc)
        dashBad.push(
          "the goal ring has no conic-gradient -- most likely --goal-pct arrived as a percentage, which makes calc() invalid and drops the whole gradient",
        );
      if (!res.dash.ring.masked) dashBad.push("the goal ring is unmasked, so it renders as a filled pie");
      // A ring the fixture reports as 0% is indistinguishable from a goal nobody has started, so
      // the number itself is asserted: the fixture hard-codes 13, matching its 134/1000 label.
      if (res.dash.ring.pct !== "13")
        dashBad.push(`--goal-pct resolved to "${res.dash.ring.pct}", expected the fixture's 13`);
      if (res.dash.ring.w < 24 || res.dash.ring.h < 24)
        dashBad.push(`the goal ring is ${res.dash.ring.w}x${res.dash.ring.h}px, too small to read`);
      if (res.dash.ring.w !== res.dash.ring.h)
        dashBad.push(`the goal ring is ${res.dash.ring.w}x${res.dash.ring.h}px -- an ellipse, not a ring`);
    } else if (res.dash.ring.content !== "none") {
      dashBad.push("the doodle goal card grew a ring -- the atlas ::before is not scoped to the skin");
    }

    /* The week curve. Skin-agnostic, unlike the ring: the same drawing runs on paper and on glass
       and only its material differs, so every claim here holds for both. */
    if (!res.dash.week) {
      dashBad.push("the week chart's plot, axis or line is missing from the dashboard fixture");
    } else {
      const wk = res.dash.week;
      if (wk.days !== 7) dashBad.push(`the week axis has ${wk.days} days, expected 7`);
      // Seven tracks at every width, including 320px. An axis that reflowed to fewer columns would
      // stop putting each label under its own point, which is the only thing tying the two
      // together -- the curve is drawn at those column centres.
      if (wk.tracks !== 7)
        dashBad.push(`the week axis resolved to ${wk.tracks} grid tracks at ${w}px, expected 7`);
      // 92px on a phone, 128px above the comfort breakpoint, plus the atlas skin's own 8px of
      // padding on each side of the plot. Definite either way, or both layers collapse.
      const wantPlot = (w <= 768 ? 92 : 128) + 2 * wk.pad;
      if (Math.abs(wk.plotH - wantPlot) > 1)
        dashBad.push(`the week chart's plot is ${wk.plotH}px at ${w}px, expected ${wantPlot}`);
      if (!wk.svgFills) dashBad.push("the week chart's svg has no height");
      // A `d` the browser rejected leaves a zero-length path, which draws nothing and reads as a
      // week with no sessions in it. The fixture's four-point curve is ~500 user units long.
      if (wk.lineLen < 100)
        dashBad.push(`the week curve is ${wk.lineLen} units long -- the path data did not parse`);
      // Four elapsed days in the fixture, three still to come. A dot for a day that has not
      // happened would be the chart asserting a zero it does not know.
      if (wk.dots !== 4)
        dashBad.push(`the week chart drew ${wk.dots} dots, expected 4 -- one per elapsed day, none for the future`);
      if (!wk.topDot) {
        dashBad.push("the week chart has no dots at all");
      } else if (Math.abs(wk.topDot.got - wk.topDot.want) > 1.5) {
        dashBad.push(
          `the highest week dot sits ${wk.topDot.got}% down the plot but was placed at ${wk.topDot.want}% -- the dots and the curve are no longer in the same coordinate space`,
        );
      }
      /* The mood. Both ends of the line's gradient have to be this run's own palette, which is the
         whole point of routing the stops through CSS instead of writing `stop-color` attributes:
         a hardcoded hex would look right in notebook and wrong in the other four, and nothing else
         in this harness would notice. */
      if (wk.lineFrom !== wk.wantPrimary)
        dashBad.push(`the week curve starts at ${wk.lineFrom}, not the mood's --primary ${wk.wantPrimary}`);
      if (wk.lineTo !== wk.wantAccent)
        dashBad.push(`the week curve ends at ${wk.lineTo}, not the mood's --accent ${wk.wantAccent}`);
      if (wk.areaFrom !== wk.wantPrimary)
        dashBad.push(`the week chart's fill is ${wk.areaFrom}, not the mood's --primary ${wk.wantPrimary}`);
      // SVG contents do not flip with `direction`, so in RTL the curve has to be mirrored by hand
      // or it runs Sunday-to-Saturday underneath labels running the other way.
      const wantMirror = wk.dir === "rtl";
      const isMirrored = wk.mirrored.startsWith("-1");
      if (isMirrored !== wantMirror)
        dashBad.push(
          `the week curve is ${isMirrored ? "mirrored" : "not mirrored"} in ${wk.dir}, so it runs against its own axis labels`,
        );
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
      p5Bad.length ||
      hdrBad.length ||
      taskBad.length ||
      stickyBad.length ||
      doodleBad.length ||
      timerBad.length ||
      analyticsBad.length ||
      detailBad.length ||
      dashBad.length ||
      setupBad.length ||
      batchBBad.length;
    if (bad) fail++;
    console.log(
      `\n[${tag}] doc=+${res.doc} clipped=${res.clipped.length} tiny=${res.tiny.length} spill=${res.spill.length}` +
        (res.nav ? ` nav=${res.nav.shown ? `${res.nav.navH}px` : "hidden"} padB=${res.nav.padB}` : "") +
        ` hdr=h1:${res.hdr.h1}px/${res.hdr.xs ? "xs" : res.hdr.base ? "base" : "?"}` +
        ` batchA=max${Math.max(...res.p5.map((d) => d.bw))}px/${res.p5.length}sel` +
        ` batchB=${distinct(res.batchB.goalPapers)}paper/tilt${res.batchB.planTilted}/${res.batchB.marks.every((m) => m !== "none") ? "marks" : "nomarks"}` +
        ` task=${res.task.tilted ? "tilt" : "flat"}/${res.task.tape ? "tape" : "notape"}/minH${res.task.minH}` +
        ` add=${res.addFlow.ownLine ? "ownline" : "inline"}/cap${res.addFlow.capShown.filter(Boolean).length}` +
        ` vitals=${res.vitals.rows}row/${res.vitals.ecgShown ? "ecg" : "noecg"}` +
        ` sticky=${res.sticky.rows}row/glyph${res.sticky.glyphW}px/sel${res.sticky.selH}px` +
        ` doodle=${new Set(res.doodle.chipCorners).size}corner/${res.doodle.selAppearance}/tilt${res.doodle.cardTilted}` +
        ` timer=pill${res.timer.indOffset}px/plate${res.timer.plateR}<=${res.timer.tickInnerR}<${res.timer.tickOuterR}<=${res.timer.ringInnerR}/digits${res.timer.digitsW}` +
        ` fs=${res.timer.fs.plateR}<=${res.timer.fs.ringInnerR}/digits${res.timer.fs.digitsW}` +
        ` art=${res.timer.fs.art.map((a) => (a.shown ? `${a.w}px` : "off")).join("+")}` +
        ` ana=${ana.panelBorder}px/${ana.panelMarks === "none" ? "nomarks" : "marks"}/${ana.ringsMissing.length}noline/cell${new Set(ana.cellCorners).size}corner/sel${ana.selH}px/${ana.step1Shown ? "24h" : "4h"}/${distinct(ana.toneInks)}tone` +
        ` plan=${det.fields}field/${det.factRows}factrow/nav${det.navGap}px` +
        ` dash=${res.dash.tileCols}col/${res.dash.gridTracks}track/stack${res.dash.stackGaps.map((s) => s.got.join(",") || "-").join("|")}of${res.dash.stackGaps[0]?.want}px/head${res.dash.stickyRows}+${res.dash.cardRows.join("+")}row/over${res.dash.gridOver}px` +
        ` /art${res.dash.art?.shown ? "on" : "off"}/ring${res.dash.ring?.content === "none" ? "off" : `${res.dash.ring?.pct}%`}` +
        ` /week${res.dash.week?.days}d${res.dash.week?.dots}dot/${res.dash.week?.plotH}px/len${res.dash.week?.lineLen}/top${res.dash.week?.topDot?.got}~${res.dash.week?.topDot?.want}${res.dash.week?.mirrored?.startsWith("-1") ? "/flip" : ""}` +
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
        `    DECO  ${d.sel} border=${d.bw}px xsShadow=${d.xs} -- expected border <=1.5px and shadow "${res.xsShadow}", got "${d.got}"`,
      );
    for (const d of p5Bad)
      console.log(
        `    BATCHA ${d.sel} border=${d.bw}px -- expected ${skin === "doodle" ? ">=2px of doodle ink" : "a <=1px atlas rim"}`,
      );
    for (const m of batchBBad) console.log(`    BATCHB ${m}`);
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
/* Atlas sweeps all five palettes; doodle only guards notebook and cosmic, which are the
   two the light/dark comparison below actually needs. */
const EXPECTED_INK_KEYS = [
  "atlas/notebook",
  "atlas/cosmic",
  "atlas/sakura",
  "atlas/aurora",
  "atlas/sunset",
  "doodle/notebook",
  "doodle/cosmic",
];
const litMoods = Object.keys(CHART_INK);
const missingInk = EXPECTED_INK_KEYS.filter((k) => !CHART_INK[k]);
if (missingInk.length)
  inkBad.push(`no chart ink recorded for ${missingInk.join(", ")} (got ${litMoods.join(", ")})`);
/* The light-vs-dark comparison runs once per skin. Chart ink is a palette concern, so both
   skins must pass it independently -- a hardcoded hex introduced under one skin would
   otherwise hide behind the other skin's correct token. */
for (const skin of ["atlas", "doodle"]) {
  const light = CHART_INK[`${skin}/notebook`];
  const dark = CHART_INK[`${skin}/cosmic`];
  if (!light || !dark) continue;
  for (const [what, key] of [
    ["tooltip border", "tip"],
    ["heat cell fill", "heat"],
    ['"Deeper insights" fill', "cta"],
    ["signal card ink", "signal"],
  ]) {
    if (light[key].replace(/\s/g, "") === dark[key].replace(/\s/g, ""))
      inkBad.push(
        `[${skin}] ${what} is ${light[key]} in both notebook and cosmic -- it is not reading a token`,
      );
  }
}
if (inkBad.length) {
  fail++;
  console.log("\n[chart ink across moods]");
  for (const m of inkBad) console.log(`    INK   ${m}`);
} else if (CHART_INK["atlas/cosmic"]) {
  for (const skin of ["atlas", "doodle"]) {
    const light = CHART_INK[`${skin}/notebook`];
    const dark = CHART_INK[`${skin}/cosmic`];
    if (light && dark)
      console.log(
        `\n[chart ink across moods: ${skin}] tooltip ${light.tip} -> ${dark.tip}, heat ${light.heat} -> ${dark.heat}`,
      );
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
 * physical-property slip there would show up as an RTL-only asymmetry.
 *
 * Both skins, though -- unlike the mood, the skin does change sidebar geometry: it swaps the
 * 2px doodle border for a 1px rim, and a border is part of the box. */
const SIDEBAR_RUNS = [];
for (const skin of ["atlas", "doodle"]) {
  for (const dir of ["ltr", "rtl"]) {
    for (const h of [700, 900, 1080, 1440, 2160]) SIDEBAR_RUNS.push([skin, 1440, h, dir]);
  }
}
// 769px is the first width at which the sidebar is not `display: none`.
SIDEBAR_RUNS.push(["atlas", 769, 1080, "ltr"]);

for (const [skin, w, h, dir] of SIDEBAR_RUNS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`file:///${process.cwd().replace(/\\/g, "/")}/${DIR}/css-geometry.html`);
  // Transitions off before the skin is stamped, for the reason spelled out in the main sweep:
  // the nav links transition, so a later duration change cannot catch a flip already in flight.
  await page.addStyleTag({
    content: "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }",
  });
  await page.evaluate(
    ({ s, d }) => {
      document.documentElement.dataset.skin = s;
      document.documentElement.dir = d;
    },
    { s: skin, d: dir },
  );
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

  const tag = `sidebar ${skin} ${w}x${h}${dir === "rtl" ? " rtl" : ""}`;
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