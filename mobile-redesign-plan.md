# Mobile UI Redesign Plan — Alex Study

> Note for Claude Code: this plan is based on an actual read of the code in `alexstudy2/alex-study` (main branch), not guesswork. Work through each phase in order, run `npm run typecheck` and `npm run lint` after each phase, and test both RTL (Arabic) and LTR (English) since the app is fully bilingual.

---

## 0) Summary of the requested fixes

1. Non-home pages feel cluttered and text-heavy on mobile, and are uncomfortable to scan.
2. The mobile sidebar ("More" menu) needs a full redesign as a sheet that opens **from the top**.
3. Unify the theme system: remove Light/Dark/Girly/System entirely and keep only the existing 5 "Study Moods" as the single theme system. Also fix the bottom nav bar sometimes covering page content.
4. Make every secondary page's header look nicer — better typography and framing than the current plain dashed-underline style.
5. Give the Tasks page a dedicated mobile redesign.
6. Give the Focus timer real animations and a much nicer look.

---

## 1) Mobile "More" menu → full Top Sheet redesign

### Current state (the problem)
File: `src/components/navigation/app-shell.tsx` (lines ~266-313) and `src/styles/shell.css` (lines ~477-493).

- The extra menu is a raw `<details><summary>` with zero React control.
- It opens as a small popover (`width: 220px`) in the bottom-right corner, right above the bottom nav (`position: fixed; bottom: 64px`), which causes:
  - Content gets clipped when there's a lot of it (`max-height: calc(100dvh - 80px)` with `overflow-y: auto` inside a cramped box).
  - No enter/exit animation at all.
  - No focus trap and no `Escape`-to-close.
  - Visually inconsistent with the rest of the app (it doesn't get the same doodle-card styling used everywhere else).

### The new design
A full **Top Sheet** (slides down from the top of the screen), opened from the "More" button in the bottom nav, covering most/all of the screen (full-height sheet), styled consistently with the Doodle Design System.

**Proposed structure:**

```
Bottom nav (mobile-navigation) stays fixed with the same 4 primary items
↓ tapping "More"
Top Sheet overlay:
 ┌─────────────────────────────┐
 │  [X] Close          Alex Study│ ← Sticky header: app name + close button
 ├─────────────────────────────┤
 │  Profile (avatar + name)      │
 ├─────────────────────────────┤
 │  Study                        │ ← Section title, same style as sidebar-group-title
 │   • Dashboard • Tasks • Focus │ ← 2-column grid instead of a vertical list, to shorten scroll length
 ├─────────────────────────────┤
 │  Planning                     │
 │   • Calendar • Exam Plan • Goals│
 ├─────────────────────────────┤
 │  Insights                     │
 │   • Sessions • AI Insights • Analytics│
 ├─────────────────────────────┤
 │  Community                    │
 │   • Lobbies • Friends • Challenges│
 ├─────────────────────────────┤
 │  🎨 Study Mood (Theme)        │ ← Same StudyBackgroundSelector, variant="cards"
 │   [tappable small cards]      │
 ├─────────────────────────────┤
 │  🔔 Notifications  ⚙️ Settings│
 │  🚪 Sign out                  │
 └─────────────────────────────┘
```

### Technical implementation

1. **Replace `<details>` with React-controlled state** in `app-shell.tsx`:
   ```tsx
   const [moreOpen, setMoreOpen] = useState(false);
   ```
   Remove the `<details><summary>...</summary>...</details>` block entirely and replace it with a `<button onClick={() => setMoreOpen(true)}>` plus the sheet itself as a separate component, rendered conditionally.

2. **Create a new component** `src/components/navigation/mobile-more-sheet.tsx` that takes the same props (`navigationGroups`, `pathname`, `ar`, `unreadCount`, `onSignOut`, etc.) and renders via a React Portal (`createPortal`) so it sits above everything without inheriting any `z-index`/`overflow` constraints from its parent.

3. **Animation** — per the project's own animation rules (`.agents/skills/animate/SKILL.md`):
   - This is an "occasional" element (user-triggered by tapping, not something seen hundreds of times a day) → normal animation is appropriate.
   - Use `transform` + `opacity` only, never `height`/`top`.
   - Enter: `translateY(-100%) → translateY(0)` with `opacity 0 → 1`, `ease-out`, short duration (~200-250ms).
   - Exit: same motion reversed, slightly faster.
   - Backdrop: `opacity: 0 → 0.5`, same timing.
   - Respect `prefers-reduced-motion: reduce` (fade only, or no animation).

4. **Accessibility:**
   - `role="dialog"` `aria-modal="true"` with a proper `aria-label` in Arabic/English.
   - Focus trap: move focus to the close button or first link on open.
   - Close on `Escape` and on backdrop tap.
   - Return focus to the "More" button on close.
   - Lock body scroll while open (`overflow: hidden` on `<body>`).

5. **New CSS** in `shell.css`, replacing the `.mobile-more-menu` block entirely:
   - The sheet: `position: fixed; inset-inline: 0; top: 0; max-height: min(85dvh, 640px); border-radius: 0 0 var(--radius-doodle-card) var(--radius-doodle-card); border: 2px solid var(--secondary); border-top: none; box-shadow: var(--shadow-doodle-lg); z-index: 200; overflow-y: auto;`
   - Links inside the sheet: use a **two-column grid** (`grid-template-columns: 1fr 1fr`) for the primary items instead of the current vertical list, to reduce scroll length.
   - Buttons large enough to tap (min 44×44px) with clear spacing.
   - Backdrop: `position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 199;`

6. **The "More" button in the bottom bar** should reflect open state via `aria-expanded` and swap to an X icon while open.

---

## 2) Unify the theme system (remove Light/Dark/Girly, keep only the 5 moods)

### Current state — there are **two parallel, conflicting systems**:

**System 1 — Theme (`data-theme`)**: `LIGHT / DARK / GIRLY / SYSTEM`
- Controlled by `cycleTheme()` in `app-shell.tsx` (lines 161-180).
- Actually changes the core color tokens (`--surface`, `--text`, `--background`, etc.) — defined in `src/styles/tokens.css`.
- Persisted server-side: `prisma/schema.prisma` → `enum Theme { SYSTEM LIGHT DARK GIRLY }` and `UserPreference.theme`.
- Applied on the server: **`src/app/layout.tsx`** sets `data-theme` directly on `<html>` at request time from `profile.preference.theme`, so the correct theme is present on first paint (no flash).
- Sent to the API via `PATCH /api/me/preferences`.

**System 2 — Study Mood (`data-mood`)**: `notebook / sakura / cosmic / aurora / sunset`
- Controlled by `StudyBackgroundSelector` (`src/components/ui/study-background-selector.tsx`) and rendered visually by `StudyBackground` (`src/components/ui/study-background.tsx`).
- Currently **only changes a decorative ambient background** (`.study-ambient-canvas` in `components.css`, ~line 4716+) — it does **not** touch the core text/card color tokens.
- Persisted **only in `localStorage`** (`alex-study-bg-mood`) — **not stored in the database at all**, so it's lost when the user switches devices or clears their cache.
- Applied **entirely client-side**, in a `useEffect` that runs after mount. `StudyBackground` and `StudyBackgroundSelector` both initialize `mood` state to `"notebook"` and only overwrite it after reading `localStorage` post-mount. **This causes a visible flash of the wrong mood on every page load** for anyone who picked sakura/cosmic/aurora/sunset — unlike the theme, which is set server-side and has no flash.

**The real problem:** if the user picks `cosmic` (dark, starry background) while the theme is still `LIGHT`, you get a dark decorative background with light-themed cards/text on top of it — a real, verifiable visual/contrast conflict that exists in the current code today, not a hypothetical.

**Additional related bug found:** `src/styles/base.css` has `html[data-theme="dark"] { color-scheme: dark; }`, which drives native browser UI (form controls, default scrollbars) to dark mode. This is wired to `data-theme`, so once that system is removed it needs to be re-keyed to `data-mood` (and extended for whichever new moods end up dark, e.g. `cosmic`).

### Required fix: **merge the two systems into one** (the 5 moods only)

1. **Remove the Theme system entirely from the UI:**
   - In `app-shell.tsx`: delete the `Theme` type, `applyTheme()`, `cycleTheme()`, the `theme` state, the entire toggle button (lines 139-180 and the footer theme button at lines 236-246), and `themeLabels`.
   - Remove now-unused imports (`Monitor`, `Moon`, `Sun` if unused elsewhere; `Heart` likely stays since it's used by a mood).

2. **Make the 5 "Study Moods" the single official theme**, and have each mood drive the core color tokens, not just the decorative background:
   - In `tokens.css`: change selectors from `[data-theme="light|dark|girly"]` to `[data-mood="notebook|sakura|cosmic|aurora|sunset"]`:
     - `notebook` → takes today's `light` values (default).
     - `sakura` → takes today's `girly` values (pink/violet) — already exists, ready to reuse.
     - `cosmic` → takes today's `dark` values — already exists, ready to reuse.
     - `aurora` (calm mint/cyan) → **needs a new token set**, built around `--success` (#10B981) and cyan, following the same token structure (primary/secondary/surface/background/text/muted/line/shadow-doodle...) and the WCAG 2.2 AA contrast bar already stated in `design-system SKILL.md`.
     - `sunset` (warm amber) → **needs a new token set** built around `--warning` (#F59E0B), same rules.
   - Verify each new palette (aurora, sunset) meets sufficient text/background contrast (at least 4.5:1 for body text) — this is the same rule already written into `.agents/skills/design-system/SKILL.md`.

3. **Fix the flash-of-wrong-mood by initializing on the server**, the same way `data-theme` is handled today:
   - In `layout.tsx`: read `profile.preference.studyMood` (see step 4) and set `data-mood` directly on `<html>`, exactly like `data-theme` is set today. This is now more important than before, since mood will drive real colors and contrast, not just decoration.
   - Update `html[data-theme="dark"] { color-scheme: dark; }` in `base.css` to key off `data-mood` instead (e.g. `html[data-mood="cosmic"]`), and add `color-scheme` entries for any other mood whose surface is dark, if applicable.
   - `StudyBackground` and `StudyBackgroundSelector` should accept an `initialMood` prop (server-provided) instead of always defaulting to `"notebook"` before the `useEffect` runs.

4. **Wire `StudyBackgroundSelector` to apply colors, not just background:**
   - `selectMood()` in `study-background-selector.tsx` already does `document.documentElement.dataset.mood = mood` — that's fine, but `tokens.css` now needs to actually key off that same attribute.
   - Remove any remaining code that reads `dataset.theme`.

5. **Persist the mood in the database, not just localStorage:**
   - In `prisma/schema.prisma`: replace `enum Theme { SYSTEM LIGHT DARK GIRLY }` with `enum StudyMood { NOTEBOOK SAKURA COSMIC AURORA SUNSET }`, and rename `UserPreference.theme` to `UserPreference.studyMood @default(NOTEBOOK)`. Run an actual migration (`npx prisma migrate dev`), don't just hand-edit the schema.
   - Update `src/lib/settings/validation.ts` (`studyPreferencesSchema`) to accept `studyMood` instead of `theme`.
   - Update `PATCH /api/me/preferences` and `layout.tsx` (where `initialTheme` is currently read server-side and passed into `AppShell`) to work with `initialMood` instead.
   - In `StudyBackgroundSelector`, after each selection, call `PATCH /api/me/preferences` following the same optimistic-update-with-rollback pattern `cycleTheme` already uses, so the choice syncs across devices instead of living only in `localStorage`.

6. **Consolidate the duplicated "Study Mood" control.** Right now the mood picker is rendered in two separate places with two different layouts: the desktop sidebar footer (`variant="sidebar"`) and inside the current mobile "More" menu (also `variant="sidebar"`, duplicated markup). Once the Top Sheet from Section 1 exists, it should be the single mobile home for this control — don't keep a second copy floating elsewhere on mobile.

7. **Rename "Study Mood" to be the app's one and only "Theme" label** everywhere — desktop sidebar, the new mobile Top Sheet, and the `/settings` page if it has a separate theme control there; check it and merge into the same mechanism.

8. **Search the whole codebase** (`grep -rn "data-theme\|Theme\b" src prisma`) for any remaining reference to `data-theme` or `LIGHT/DARK/GIRLY/SYSTEM` and make sure it's removed or migrated, especially:
   - Anywhere reading `prisma.userPreference.theme` (API routes, server components).
   - Any other component rendering a sun/moon icon tied to the old theme.

---

## 3) Bottom nav sometimes covers content

### Likely cause
- `.app-content` only gets `padding-bottom: calc(72px + env(safe-area-inset-bottom, 16px))` inside `@media (max-width: 768px)` in `shell.css` (lines 271-279) — confirm every page actually renders inside `.app-content` and nothing overrides that inheritance with its own `overflow`/`position`.
- Some inner shells (e.g. `.page-shell`) add their own `padding-block` (`var(--space-4) var(--space-8)`), but not all of them add enough bottom space when content is long plus a variable-height banner is present (e.g. `.active-timer-banner`).
- Any `position: fixed` element that doesn't account for `60px + safe-area` (the bottom nav's height) — e.g. the celebration overlay, or any future toast/snackbar — can end up overlapping it.

### What to do
1. Audit every fixed-position element (`grep -rn "position: fixed" src/styles`) and confirm each one accounts for the bottom nav's height (`60px + env(safe-area-inset-bottom)`) on mobile viewports, either via `bottom: calc(...)` or a shared CSS variable.
2. Define a shared CSS variable, e.g.:
   ```css
   :root {
     --mobile-nav-height: 60px;
   }
   @media (max-width: 768px) {
     :root { --mobile-nav-total: calc(var(--mobile-nav-height) + env(safe-area-inset-bottom, 0px)); }
   }
   ```
   and use it everywhere instead of hardcoded magic numbers — easier to maintain and prevents this class of bug recurring. Note the new Top Sheet from Section 1 never needs this variable since it opens from the top.
3. Make sure the last scrollable element on every page (especially long lists like `/tasks`, `/friends`, `/notifications`) has enough space below its last item so it isn't hidden behind the bar.
4. Manually test (or use Playwright — the repo already has `e2e/` and `playwright.config.ts` set up) on a real mobile viewport (small-height iPhone SE, plus a standard phone) across: dashboard, tasks, focus, calendar, goals, sessions, insights, analytics, lobbies, friends, challenges, notifications, settings.

---

## 4) Reduce visual clutter and improve mobile comfort

### Findings from reading the code (not assumptions)
- The Doodle Design System (organic borders, `shadow-doodle` on everything, dashed rules) gives the app its personality, but repeating all of it on every single card/section on mobile creates visual noise.
- `/dashboard`, for example, stacks: Hero Card + Active Timer Banner (conditional) + a two-column layout (Sticky Tasks + AI Memo Card in one column, Study Card + Goals Card in the other) — on mobile all of that stacks vertically at full size with full borders, which is exactly why it reads as "long and cluttered."
- The base font size `--text-sm: 1rem` (16px) is already a good mobile size, so the issue isn't font size — it's **how many fully-decorated elements are visible at once**.

### Recommendations
1. **Reduce decoration on small screens only** (don't touch the desktop experience):
   ```css
   @media (max-width: 768px) {
     .dashboard-card, .dashboard-memo-card, .dashboard-hero-card {
       box-shadow: var(--shadow-doodle-xs); /* instead of md/lg */
       border-width: 1.5px;
     }
   }
   ```
2. **Progressive disclosure instead of showing everything at once**: on long pages (analytics, insights, sessions) use tabs or accordions to split content instead of one long continuous scroll — review each page individually to identify "secondary" sections that can collapse by default.
3. **Hide secondary copy on mobile**: descriptive text under headings (e.g. `.dashboard-hero-sub`) should shorten or hide on very small screens (`<380px`) when it's not essential.
4. **Breathing room between sections**: gaps between cards on mobile shouldn't be less than `var(--space-4)` (16px); raise it to `var(--space-5)` between major sections (not within the same card) to create visual separation without relying purely on borders.
5. **Visual priority**: on each page, pick one primary action and make it the most prominent (primary color + larger size); let everything else recede (neutral/muted colors) — this reduces the "everything is equally loud" feeling.
6. **Test Arabic text length**: Arabic text typically takes more horizontal space than English for the same meaning — make sure headings and buttons in any new or modified cards handle wrapping/truncation gracefully in both directions.

---

## 5) Prettify secondary page headers (typography + framing)

### Current state
`src/styles/shell.css` (lines ~63-172) defines one shared header style used by nearly every secondary page (`.dashboard-header`, `.tasks-header`, `.focus-header`, `.calendar-header`, `.goals-header`, `.lobbies-header`, `.analytics-header`, `.insights-header`, `.exam-plan-header`, `.settings-header`, `.sessions-header`, `.challenges-header`, etc.):

```css
.page-header-container, .dashboard-header, ... {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-block: var(--space-2) var(--space-4);
  margin-bottom: var(--space-6);
  border-bottom: 2px dashed var(--secondary);
}
```

It's just a flex column with a dashed underline — no card, no background, no icon, minimal typographic hierarchy beyond size. This is plain compared to how `/dashboard` and `/tasks` treat their own headers (`.dashboard-hero-card`, `.notebook-top-header`), which both use a proper bordered/shadowed card with an icon badge — so the site currently feels inconsistent: some pages get a "designed" header, most get a bare one.

### What to do
Give every secondary page the same elevated header treatment the best pages already use, instead of the current plain underline:

1. **Turn the shared header into a doodle card**, similar to `.notebook-top-header`:
   ```css
   .page-header-container, .dashboard-header, /* ...same selector list... */ {
     border: 2px solid var(--secondary);
     border-radius: var(--radius-doodle-card);
     background: var(--surface);
     box-shadow: var(--shadow-doodle);
     padding: var(--space-4) var(--space-5);
     border-bottom: 2px solid var(--secondary); /* replace the dashed underline-only look */
   }
   ```
   On mobile, use the same reduced-shadow rule from Section 4 (`--shadow-doodle-xs`) so it doesn't compete visually with the content below it.
2. **Add a small icon badge** next to the title on pages that don't already have one (most pages have a relevant lucide icon imported already — e.g. `CalendarDays` for calendar, `Target` for goals, `Trophy` for challenges) using the same `.header-icon-box` style already defined for the Tasks page header (`src/styles/components.css` ~line 783). This gives every page the same visual anchor `/tasks` already has, instead of `/tasks` being the odd one out.
3. **Typography pass on the title itself:**
   - Keep `font-family: var(--font-heading)` (Delius Swash Caps) but confirm `letter-spacing` and `line-height` are tuned per size — at the current `clamp(1.8rem, 3.5vw, 2.5rem)` the swash caps font can feel cramped at the low end of that clamp on narrow phones; consider bumping the mobile minimum slightly (e.g. `clamp(1.6rem, 6vw, 2.5rem)`) so it never looks squeezed at 360px width.
   - Add a subtitle/eyebrow pattern consistently: a small uppercase label above the `h1` (like `.dashboard-hero-card`'s `.eyebrow`) on pages that currently jump straight from icon to title with no supporting context line.
4. **Consistency check**: after the change, visually diff every page's header (dashboard, tasks, focus, calendar, goals, lobbies, sessions, challenges, leaderboard, analytics, insights, exam-plan, settings) to confirm none of them ends up with broken spacing from the shared selector picking up unexpected children (some of these headers have extra elements like `.page-header` segmented tab pills nested inside — verify padding still reads correctly once the header becomes a bordered card instead of a plain block).

---

## 6) Tasks page — dedicated mobile redesign

### Current state
Files: `src/app/tasks/page.tsx`, `src/components/tasks/task-workspace.tsx` (685 lines), CSS in `src/styles/components.css` (~lines 760-1546, note some rules like `.master-notebook-card`, `.notebook-quick-add-line`, `.notebook-task-list` are defined **twice** — once around line 982 and again with mobile overrides around line 1449 — worth double-checking for duplication/dead rules while you're in there).

The page is a "study notebook" concept: a header card, a horizontally-scrolling row of subject filter chips, an inline quick-add form (text input + 2 selects + button, all in one row), and a pinboard-style grid of "sticky note" task cards, each one carrying:
- A drag handle + complete-toggle on the left,
- Title + priority pill,
- A row of badges (subject tag, due date, estimated minutes, subtasks counter),
- An expandable subtasks list,
- A separate row of manual reorder buttons (up/down) plus delete — **duplicating** what drag-and-drop already does.

On mobile, `components.css` line 1793-1795 already collapses the grid to a single column and removes the sticky-note rotation, and line 1800-1810 adjusts the quick-add row — but the cards themselves keep **all** their chrome (drag handle, dashed subtasks box, priority pill, 4 badge types, move-up/move-down buttons, delete button, dashed borders, sticky-note tape effect) at full size, stacked one after another. That's exactly why this page in particular feels the most crowded on a phone: it's the single densest card design in the app, now shown one-per-row instead of in a grid.

### What to do — a real mobile-specific layout, not just a narrower grid

1. **Collapse the redundant reorder controls on mobile.** The move-up/move-down buttons (`.task-row-actions`) exist because pointer-based drag-and-drop is unreliable on touch — that's a legitimate reason to keep them, but they don't need to sit permanently visible on every card. On mobile, hide them behind the same "..." /expand affordance as the subtasks toggle, or only reveal them once a card is in an explicit "reorder mode" toggled from the page header. This alone removes 2 buttons' worth of chrome from every card.
2. **Simplify the badge row on mobile.** Currently up to 4 badges (subject, due date, minutes, subtasks) can appear per card. On mobile:
   - Keep the subject tag and due date (the two the user scans for most).
   - Fold estimated minutes into the due-date pill instead of a separate pill (e.g. `Tomorrow, 3:00 PM · 45m`).
   - Keep the subtasks counter but drop its own pill styling in favor of a plain inline `2/5` next to the title, tappable to expand.
3. **Rethink the quick-add row for mobile.** Right now it's a text input plus two `<select>`s plus a submit button all inline (`components.css` ~1793-1810 wraps them but they're still visually busy). On mobile, collapse it to just the text input + submit button by default, and move subject/priority selection into a small popover or bottom sheet triggered by a "＋ options" icon next to the input — so the primary action (typing a task and hitting enter) isn't visually competing with two dropdowns every time.
4. **Reduce card decoration specifically on mobile** (in addition to the general Section 4 rule): drop the sticky-note tape/rotation effect entirely below 768px (it's already disabled at 1794, good) and also reduce `min-height: 12rem` (line 1794) — that minimum height was sized for the pinboard-grid look, but in a single column it just adds a lot of dead vertical space per card when the content is short. Let cards size to their actual content on mobile with a much smaller `min-height` (or none at all).
5. **Subjects filter row**: it's already a horizontally-scrolling chip row (`.subjects-scroll`), which is the right pattern for mobile — no change needed there, just confirm chip `min-height: 2.5rem` (line 1554) still meets the touch-target minimum after other spacing changes.
6. **Filter tabs** (`all/today/upcoming/completed`) already scroll horizontally on narrow screens (noted directly in the CSS comment at line 819) — keep that, just re-test it after the header card restyle in Section 5 to make sure spacing above it still looks intentional.
7. **Net result to aim for**: a mobile task card that, collapsed, shows only checkbox + title + priority + due date, with subtasks and reorder controls tucked behind explicit taps — turning today's "everything visible, always" sticky note into a scannable list that only expands the parts the user actually wants to look at.

---

## 7) Focus timer — animation and visual redesign

### Current state
File: `src/components/sessions/focus-workspace.tsx` (744 lines) + CSS in `src/styles/components.css` (`.doodle-timer-card` ~1964, `.timer-dial` ~2262, `.giant-timer-digits` ~2045/2291, `.timer-live-status` ~2245).

What exists today:
- The circular progress ring (`.timer-dial`) is a `conic-gradient` driven by a `--timer-progress` CSS custom property (in degrees), with only `transition: background 0.25s linear;` — so it does move, but `background` is not a GPU-accelerated property, and a linear conic-gradient transition looks mechanical/ticky rather than smooth.
- The countdown digits (`.giant-timer-digits`) are a plain `<output>` — the text content is replaced every second with no transition at all, so each second just "pops" to the new value.
- The only animation anywhere in the timer is `.timer-live-status.running i { animation: timer-pulse 1.5s ease-in-out infinite; }` — a tiny 0.55rem status dot that scales up and down. That's the entire motion budget for what should be the emotional centerpiece of the app.
- No animation on Start (the dial and buttons just appear), no animation tied to Pause/Resume, no distinct treatment when a session completes beyond the separate `.celebration-overlay` (which is a generic modal used elsewhere too, not something built specifically for finishing a focus session).

### What to do

1. **Make the progress ring animate on `transform`, not `background`.** Replace (or complement) the conic-gradient with an SVG circle using `stroke-dasharray`/`stroke-dashoffset`, animated via `transform`-friendly techniques (or keep the conic-gradient for the static look but drive the *visual* progress with a layered SVG ring on top for the animated portion) — this reads as smoother motion and is cheaper to animate per the project's own animation rules (`transform`/`opacity` only; `background` triggers paint every frame).
2. **Add a breathing/pulse effect while running**, distinct from the tiny status dot: a subtle `scale(1) → scale(1.015) → scale(1)` breathing loop on `.timer-dial` itself while `timer.status === "RUNNING"`, slow (~4-6s per cycle), `ease-in-out`, paused automatically via `.timer-dial:has(...)` or a `running` class check — gives the whole dial a sense of being "alive" instead of static, and doubles as a subtle focus/breathing cue appropriate for a study timer. Must respect `prefers-reduced-motion`.
3. **Animate state transitions:**
   - **Start**: the dial should animate in (`scale(0.96) + opacity 0 → scale(1) + opacity 1`, `ease-out`, ~250-300ms) rather than snapping into its running state instantly — this is a "rare/first-time-per-session" trigger per the animation skill's frequency table, so a bit of delight here is appropriate, not excessive.
   - **Pause**: a quick, subtle visual cue (e.g. the breathing animation freezes and the ring dims slightly via `opacity`) so pausing is legible without needing to read the status pill.
   - **Complete**: build a small custom completion moment scoped to the timer card itself (ring fills fully with a brief `ease-out` flourish, then a checkmark or similar crosses into view) rather than relying solely on the generic celebration overlay — the overlay can still fire afterward for the bigger celebration, but the dial itself should visibly "finish" first.
4. **Digit transitions.** When `remaining` changes each second, animate the outgoing/incoming digit pair with a short slide/fade (a common "odometer" pattern: each digit sits in its own small container, old value slides/fades out while new value slides/fades in, `transform` + `opacity`, ~150ms) instead of an instant text swap — this is a "tens of times per session" frequency element, so keep it fast and understated, not showy.
5. **Mode-switch tabs (`FOCUS`/`SHORT_BREAK`/`LONG_BREAK`)**: give the active-tab background a sliding indicator (a single absolutely-positioned pill that translates between tab positions on `transform`) instead of the current instant background swap on `.timer-mode-tab.active` — small polish, cheap to implement, consistent with how segmented tabs are usually done.
6. **Visual refresh, not just motion**: consider softening `.giant-timer-digits`' current dashed-border/sunken-background "sticky note" treatment into something that feels more like the literal focal point of the page — e.g. let the ring itself be the primary frame and simplify the digits to sit cleanly inside it without their own competing border, so there's one clear visual anchor instead of two (ring + boxed digits) both asking for attention.
7. **Respect the reduced-motion and performance rules already established for this codebase**: gate every new animation behind `prefers-reduced-motion`, keep everything to `transform`/`opacity` (per `.agents/skills/animate/SKILL.md`), and avoid re-adding a `background`-based transition once the ring is redone as SVG.
8. **Fullscreen "Focus Mode"** (`fullscreen-focus-active`) already exists and enlarges the dial/digits — make sure all the above animations scale correctly in that mode too, since that's the primary "just look at the timer" view most users will actually spend time in.

---

## 8) Additional issues found during code review (not in the original request, but worth fixing while you're in this code)

1. **Flash of wrong mood on load (FOUC).** Already detailed in Section 2 — `StudyBackground` and `StudyBackgroundSelector` both default to `"notebook"` and only read `localStorage` in a post-mount `useEffect`. Every user who picked something other than `notebook` sees a flash of the default mood on every navigation/reload. This becomes more visible once mood drives real colors instead of just decoration, so it must be fixed as part of the merge, not left as-is.
2. **`color-scheme` hardcoded to `data-theme`.** `base.css` sets `html[data-theme="dark"] { color-scheme: dark; }`, which is now stale logic that needs to move to `data-mood`.
3. **Mood picker duplicated in two places with slightly different markup** — the desktop sidebar footer and the current mobile "More" menu both render `StudyBackgroundSelector` with the same `variant="sidebar"`, essentially copy-pasted. Once the Top Sheet exists, consolidate to one instance for mobile.
4. **The ambient background's mouse-tracking parallax runs an unconditional `requestAnimationFrame` loop** (`StudyBackground`, `pointermove`/RAF logic, lines ~43-79) that keeps running on every page even on touch devices, where `pointermove` rarely fires meaningfully. This isn't a mobile UI bug per se, but it's wasted CPU/battery on phones for a purely decorative effect — worth gating behind `window.matchMedia("(pointer: fine)")` so it's skipped on touch devices, in addition to the existing `prefers-reduced-motion` check.
5. **`components.css` has duplicated selectors** for several Tasks-page classes (`.master-notebook-card`, `.notebook-quick-add-line`, `.notebook-task-list`, `.notebook-task-row` all appear once around line 982-1078 and again around line 1449-1546). Worth confirming during the Section 6 rework whether the second block is intentional mobile/mood overrides or leftover duplication that should be merged, to avoid fighting your own rules while redesigning this page.
6. **No overlap issue found with checkboxes/inputs** — worth noting as a *non*-issue: `base.css` already bumps native checkboxes/radios to 18px for touch-target reasons (WCAG 2.5.8), and the app's `viewport` meta in `layout.tsx` doesn't block pinch-zoom (`initialScale: 1` only, no `maximum-scale`/`user-scalable=no`), so there's no accessibility regression to fix there — just flagging it as confirmed-fine so it isn't accidentally "fixed" into a worse state.

---

## 9) Phased implementation plan

| Phase | Content | Key files |
|---|---|---|
| 1 | New mobile Top Sheet | `app-shell.tsx`, `mobile-more-sheet.tsx` (new), `shell.css` |
| 2 | Merge theme system into the 5 moods + database + fix FOUC | `tokens.css`, `study-background-selector.tsx`, `study-background.tsx`, `app-shell.tsx`, `layout.tsx`, `base.css`, `schema.prisma`, `validation.ts`, `/api/me/preferences/route.ts` |
| 3 | Fix bottom nav overlapping content | `shell.css` + full audit of `position: fixed` |
| 4 | Reduce visual clutter page by page | `components.css` + review of every `page.tsx` under `src/app` |
| 5 | Prettify secondary page headers | `shell.css` (shared header selectors), `components.css` (`.header-icon-box` reuse) |
| 6 | Tasks page mobile redesign | `task-workspace.tsx`, `components.css` (lines ~760-1546) |
| 7 | Focus timer animation + visual redesign | `focus-workspace.tsx`, `components.css` (`.doodle-timer-card`, `.timer-dial`, `.giant-timer-digits` and related, ~1964-2440) |

Do these in order — Phase 2 (theming) changes the tokens everything else depends on. Phases 5-7 can happen in parallel with each other once Phases 1-4 are stable, since they touch mostly independent files.

---

## 10) Definition of Done

- [ ] No remaining reference to `data-theme` or `LIGHT/DARK/GIRLY/SYSTEM` anywhere in the code.
- [ ] The 5 moods (notebook/sakura/cosmic/aurora/sunset) actually change core colors (text, background, borders), not just the decorative background, and each one is internally consistent (sufficient contrast).
- [ ] There is no flash of the wrong mood on page load — the mood is rendered correctly on first paint, server-side, the same way the old theme was.
- [ ] The selected mood is persisted in the database and syncs correctly across devices/sessions.
- [ ] The mobile "More" button opens a full Top Sheet from the top, with a smooth animation, closable via Escape/backdrop tap/X button.
- [ ] The Top Sheet is accessible: focus trap + `aria-modal` + focus returned on close.
- [ ] No fixed-position element overlaps or is overlapped by the bottom nav on any page at the smallest supported viewport.
- [ ] Core pages (dashboard, tasks, focus, calendar) have reduced excess decoration on mobile while keeping the Doodle style identity.
- [ ] Every secondary page's header is a consistently framed, nicely typeset card, not a bare dashed-underline block.
- [ ] The Tasks page on mobile shows collapsed, scannable cards by default, with reorder controls and secondary badges tucked behind explicit taps.
- [ ] The Focus timer ring, digits, and mode tabs all animate smoothly using `transform`/`opacity`, respect `prefers-reduced-motion`, and the timer feels like the visual centerpiece of the page.
- [ ] `npm run typecheck`, `npm run lint`, and `npm test` all pass with no new errors.
- [ ] Manual/Playwright testing covers both RTL (Arabic) and LTR (English) for every change.
