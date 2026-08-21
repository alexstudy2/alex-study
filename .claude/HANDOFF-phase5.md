# Handoff — Alex Study premium redesign, resuming at Phase 5

Written 2026-08-21 at the end of Phase 4. Read this whole file before writing any code, then
start at **§7 Phase 5 work plan**. Everything in §1–§6 is context you will otherwise re-derive
expensively (or get wrong).

The approved plan lives at `C:\Users\abdom\.claude\plans\cheerful-gliding-origami.md`. This file
supersedes it wherever they disagree, because the plan was written before Phases 1–4 were built
and several of its line numbers and assumptions have since moved.

---

## 1. What the user asked for, and the four locked decisions

A comprehensive premium redesign of the **entire** app, in phases, based on the `uipro` skill.
The previous doodle design is **kept as a user-selectable option in Settings, not deleted** — the
new design is merely the default. "Don't delete doodle" is the single hardest constraint in the
project and the geometry harness exists partly to prove it.

Locked by an accepted `AskUserQuestion` — do not relitigate these:

| Axis | Decision |
|---|---|
| Style | **Liquid Glass + Aurora + Bento** — frosted glass cards over an animated aurora mesh, asymmetric bento tiles, luminous accent glows, hover lift ~1.02 |
| Artwork | **Refined SVG illustrations + generative progress visuals.** The user deliberately did **not** pick animated `<canvas>`. Every "generative" visual must be pure CSS/SVG |
| Logo | New premium SVG mark |
| Phase order | Foundation → Shell → Dashboard → Tasks → Rest |

Two later standing requests, both implemented and now gate-verified:

- Dashboard AI-insight tile replaced by a weekly study-hours **continuous premium curve** taking
  the mood colour (not columns, not bars).
- **"the task background of the task the same color as the mood not always green like that"** —
  task paper is mixed from the mood's `--primary`, never from the course colour. Course identity
  moved to the subject tag, the subject dot, the seeded watermark glyph and the note's top edge.
  Keep it that way; the harness now asserts it (§8).
- **"make the colours of updating live"** — mood/skin changes are optimistic on `<html>` and then
  `router.refresh()` pulls the new value into the cached RSC payload, so a later server render
  cannot put the old palette back.

---

## 2. Non-negotiable constraints

- **Do not call the Agent tool unless the user requests it.**
- **Do not use workflows or deep-research unless the user requests it.**
- **No live browser verification.** Verify UI through the DB-free CSS geometry harness; the user
  eyeballs the rest. Do not start a dev server to "check".
- **Never run `prisma migrate dev` or `migrate reset`.** The Supabase DB is `db push`-managed and
  has no `_prisma_migrations` table, so `migrate dev` offers a destructive reset. Use
  `npx prisma db push`.
- **Never kill the user's `next dev`.** `db:generate` can hit EPERM while it runs, and the live
  server keeps serving the stale Prisma client until restarted — *tell the user to restart it*.
- **`AGENTS.md`:** this Next.js (16.3.0) has breaking changes vs. training data. Read the relevant
  guide under `node_modules/next/dist/docs/` before writing framework code. The AGENTS.md block is
  re-written by `next dev`; deleting it from a diff just recreates the uncommitted change.
- **`.env` holds live credentials.** Any inspection must redact values (`sed`, host-only printing).
- Temp files go in the job's own tmp dir, never `/tmp`.
- All work so far is **uncommitted on `main`**. Do not commit or push unless asked.

---

## 3. Stack facts

Next.js 16.3.0 App Router · React 19.2.8 · TypeScript · Prisma 6.19.3 CLI / 6.19.0 client +
Supabase Postgres · NextAuth 4 · next-intl (bilingual AR/EN, full RTL) · Tailwind CSS v4 via
`@tailwindcss/postcss` bridged to CSS custom properties through **one** `@theme inline` block ·
`date-fns` + `date-fns-tz`, `DEFAULT_TIMEZONE = "Africa/Cairo"`, week starts Sunday.

Styling is Tailwind v4 mixed with a large hand-written semantic-class stylesheet:
`src/styles/components.css` is ~11.5k lines and is where almost all of this work happens.

---

## 4. The architecture you must understand before touching CSS

### 4.1 Two-axis theming

`data-mood` (`notebook | cosmic | sakura | aurora | sunset`) and `data-skin` (`atlas | doodle`),
both **server-rendered on `<html>`** in `src/app/layout.tsx`. Mood repaints colours; skin changes
materials. Both are persisted per user and both apply optimistically on the client.

- `src/lib/settings/study-mood.ts` — mood vocabulary, `applyMood`, `saveMood`
- `src/lib/settings/study-skin.ts` — skin vocabulary, `applySkin`, `saveSkin`, `skinFromEnum`
- `prisma/schema.prisma` — `enum StudySkin { ATLAS DOODLE }`, `skin StudySkin @default(ATLAS)`
  on `UserPreference`
- Pickers: `src/components/settings/settings-workspace.tsx` (skin + mood),
  `src/components/ui/study-background-selector.tsx` (mood, sidebar/compact/cards variants)

### 4.2 The atlas token remap is the load-bearing mechanism

`src/styles/tokens.css:720`, `:root[data-skin="atlas"] { … }`. `components.css` routes materials
through the **doodle token names** in ~314 places, so redefining the names reskins ~8,500 lines
without touching a component selector — and leaves doodle's values intact.

```
--radius-doodle       -> var(--bento-radius)     --border-doodle        -> var(--stroke-default)
--radius-doodle-card  -> var(--bento-radius)     --border-doodle-thin   -> var(--stroke-muted)
--radius-doodle-btn   -> 12px                    --border-doodle-dashed -> var(--stroke-muted)
--radius-doodle-chip  -> var(--radius-full)      --public-card-shadow   -> var(--elevation-3)
--shadow-doodle-xs    -> var(--elevation-1)      --shadow-doodle-lg     -> var(--elevation-3)
--shadow-doodle       -> var(--elevation-1)      --shadow-doodle-xl     -> var(--elevation-4)
--shadow-doodle-md    -> var(--elevation-2)      --doodle-caret         -> straight chevron
```

**Consequence you will forget:** a doodle rule that already says
`box-shadow: var(--shadow-doodle-md)` is *already* an atlas shadow under atlas. Do not write an
override for it. In Phase 4 I planned an elaborate `@media (min-width: 769px)` shadow-gating
scheme and then deleted almost all of it after reading this block.

**ORDER IS LOAD-BEARING.** `:root[data-skin="atlas"]` and `:root[data-mood="sunset"]` are both
(0,1,1); every mood block redeclares `--border-doodle*`/`--shadow-doodle*`. The skin block must
stay **below** the last mood block.

### 4.3 Glass tokens — `tokens.css:271–300`

```
--glass-bg          color-mix(in srgb, var(--surface) 62%, transparent)
--glass-bg-raised   color-mix(in srgb, var(--surface-elevated) 78%, transparent)
--glass-bg-sunken   color-mix(in srgb, var(--surface-sunken) 55%, transparent)
--glass-rim         color-mix(in srgb, var(--secondary) 16%, transparent)
--glass-rim-strong  …26%…            --glass-sheen
--glass-blur 20px                    --glass-blur-heavy 36px
--elevation-1  0 1px 2px rgba(15,23,42,.06), 0 0 0 1px var(--glass-rim)   … through --elevation-4
--stroke-default 1px solid var(--glass-rim)     --stroke-strong 1px solid var(--glass-rim-strong)
--stroke-muted   1px solid color-mix(in srgb, var(--line) 60%, transparent)
--bento-gap 16px   --bento-radius 20px   --bento-radius-inner 14px
```

An `@supports` block at `tokens.css:324` degrades `--glass-bg*` to the opaque `--surface*` where
`backdrop-filter` is unsupported, so no atlas rule needs its own fallback.

### 4.4 The house pattern for every atlas rule

> Add a `[data-skin="atlas"] .existing-class { … }` block **after** the existing rule.
> **Never modify the base rule.** That is what keeps doodle working with zero code changes.

### 4.5 Specificity arithmetic — this is where the bugs live

```
.foo                                              (0,1,0)
[data-skin="atlas"] .foo                          (0,2,0)
:root[data-skin="atlas"] .foo                     (0,3,0)
:root[data-mood="cosmic"] .foo                    (0,3,0)
[data-skin="atlas"] .a.b                          (0,3,0)
[data-skin="atlas"] .a.b:hover                    (0,4,0)
:not(.x)          contributes one class
@media            contributes nothing — equal-specificity rules in different media blocks are
                  decided by source order
```

Traps already hit and fixed; expect more of the same in Phase 5:

- A **mood** override at (0,3,0) beats a plain `[data-skin="atlas"]` rule at (0,2,0) regardless of
  order. This is how `:root[data-mood="cosmic"] .dashboard-card` kept ink corner-doodles and a
  `#475569` border on every glass tile in cosmic through the whole of Phase 3.
- The **mobile comfort pass** (`src/app/globals.css:317`, `@media (max-width: 768px)`, runs to the
  end of the file) is the *last* block in the entire cascade but uses bare `(0,1,0)` selectors, so
  any `[data-skin="atlas"]` rule silently opts the element out of it. Declaring shadows
  unconditionally under atlas therefore un-does the phone decluttering. Gate elevation behind
  `@media (min-width: 769px)` when the element is a member of that pass. The member list starts at
  the `--- 1.` marker (`globals.css:336`) and ends at the first `box-shadow` (`:404`);
  `scripts/css-geometry-check.mjs` **parses that list by slicing between those two points**, so
  never insert anything between them.
- A component's own state rule at (0,3,0) (e.g. `.note[data-overdue="yes"]`) outranks both, so it
  survives the comfort pass and the skin unless you match its specificity.
- `.task-priority-pill.priority-urgent` is (0,2,0) and sits ~1300 lines *above* the atlas block,
  so a (0,2,0) atlas rule wins on source order and destroys the solid urgent state. The fix in
  place uses `:not(.priority-urgent)` at (0,3,0) plus a separate rim-only urgent rule.

### 4.6 CSS gotchas that have each cost real time

- **`background:` shorthand resets `background-image`.** Use `background-color` when the element's
  image is load-bearing — the `.quick-add-select` caret is `var(--doodle-caret)`; the shared card
  family's corner doodles are data-URIs; the analytics panels' corner marks are the same and the
  harness asserts them at every width. Use the shorthand only when you *want* the image gone
  (e.g. `.master-notebook-card`'s ruled paper).
- **`color-mix()` dies on an unresolvable `var()`** — the whole declaration is invalid, so the
  element falls back to transparent. That is the historical bug that left every sticky note with
  no paper. Nested `color-mix` is the house idiom for laying a mood tint over a translucent glass
  token: `color-mix(in srgb, var(--primary) 14%, var(--glass-bg-raised))`.
- **`--accent` is the same hex as `--primary` (#49B6E5) in notebook and cosmic**, so a
  `--primary → --accent` gradient renders flat in 2 of 5 moods. Use light-tint → full `--primary`.
- **Gradients have no logical direction keyword.** Every `to right` needs a `[dir="rtl"]` companion.
- `-webkit-backdrop-filter` alongside `backdrop-filter` (iOS 15–17); `-webkit-mask` alongside `mask`
  (iOS < 15.4 renders a filled disc instead of a ring).
- `--transition-base` bundles its own cubic-bezier. Appending `var(--ease-out)` puts two timing
  functions in one component and drops the whole shorthand.
- **dnd-kit writes `CSS.Transform.toString(transform)` inline while dragging**, and inline beats
  any selector — never set `transform` on `.dragging`. Give it elevation only.
- `:hover` must be inside `@media (hover: hover)` (touch latches hover after a tap), with a
  `@media (prefers-reduced-motion: reduce)` companion that zeroes the transform but keeps the
  elevation (elevation is the affordance, not motion).

---

## 5. What is already done

| Phase | State |
|---|---|
| 1 — Foundation (glass/bento tokens, skin arch, DB `skin` column, `study-skin.ts`, layout stamping, aurora CSS mesh, new SVG logo, harness skin axis) | done |
| 2 — Shell (sidebar, bottom nav, page headers) | done |
| 3 — Dashboard bento | done |
| 4 — Task surfaces | done |
| Settings skin toggle (the doodle-preservation UI) | **done** — `settings-workspace.tsx:495`, `changeSkin` at :137, previews draw themselves with their own skin's material values |
| Weekly hours curve replacing the AI-insight tile | done |
| Mood-coloured task paper | done |
| Desktop dashboard "floaty cards" fix | done |
| 5 — Remaining routes | **not started — your job** |

### Phase 4's two atlas blocks (read them; they are the template for Phase 5)

- `components.css:3095` — `Atlas skin -- task surfaces`. Notebook header, subject ribbon,
  quick-add, sticky notes, subtask panels, the generative progress chip, vitals strip, dashboard
  task rows. Its header comment records the three cascade facts that govern it.
- `components.css:5495` — `Atlas skin -- shared card family & focus timer`. Placed *there* on
  purpose: `background-color` has to beat `.focus-workspace-container .doodle-timer-card` (0,2,0)
  and `background-image: none` has to beat `:root[data-mood="cosmic"] .doodle-timer-card` (0,3,0),
  so every rule carries a `:root` prefix and the block sits after both. **Phase 5 extends this
  block's selector list** — it currently covers only `.dashboard-card`, `.today-card`,
  `.task-card`, `.focus-sidebar-card`, `.focus-timer-card`, `.doodle-timer-card`.
- `src/components/sessions/focus-workspace.tsx:719` — `className="doodle-timer-card
  focus-timer-card"`. Both names on purpose: the doodle name is what ~40 selectors key on, the
  atlas name is the skin-neutral one. Not a rename.

### The dashboard grid fix (most recent change, worth understanding)

Atlas used to make `.dashboard-left-col` / `.dashboard-right-col` `display: contents`, promoting
the four cards to grid items of a 12-track grid. **Grid items line up in rows**, so the short
right-hand card sat in a row sized by its tall left-hand neighbour and `align-items: start` left
~170px of dead air under it — the user's "floaty and not organized". `components.css:1072` now
uses two real flex column boxes on `minmax(0,7fr) minmax(0,5fr)` at `--bento-gap`, each packing
its own children independently. Do not reintroduce `display: contents` there; the harness asserts
`display: flex` and measures the inter-card gap against each column's own `row-gap`.

Consequence the user has been told about and may still ask to change: the right column now ends
~275px above the left because it genuinely has less content. The offered follow-up was stretching
the last tile in each column to a flush bottom edge.

---

## 6. Verification — the four gates

Run all four after each batch. Report results honestly; if a gate fails, say so with the output.

```bash
node scripts/css-geometry-check.mjs   # 70 runs, must exit 0 and print PASS
npm run typecheck                     # tsc --noEmit
npm run lint                          # 0 errors; 3 pre-existing warnings, see below
npm test                              # vitest, 122 tests / 12 files
```

**Pre-existing lint warnings — not yours, do not "fix" them as part of Phase 5:** three
`@next/next/no-location-assign-relative-destination` warnings in
`src/components/navigation/app-shell.tsx:80` and `src/components/settings/settings-workspace.tsx`
:313 and :914.

### The geometry harness

`scripts/css-geometry-check.mjs` + `scripts/fixtures/css-geometry.html`. PostCSS + Tailwind
compile of the real stylesheets, measured in headless Chromium over a static fixture. **No dev
server, no DB.** Because doodle runs are in the matrix, this is also the regression guard proving
the classic skin still works.

`RUNS` (line 156) × 5 viewports:

```
atlas × {notebook, cosmic, sakura, aurora, sunset} LTR   atlas notebook RTL
doodle notebook LTR   doodle cosmic LTR   doodle notebook RTL
viewports: 320, 360, 390, 768 (mobile) and 1440 (desktop)
```

plus a separate `SIDEBAR_RUNS` sweep. 70 log lines total.

**New atlas components are measured by nothing unless you add them** to the fixture HTML *and* to
`SECTIONS` (line 38). If Phase 5 introduces a new atlas surface, mirror it into the fixture.

Useful helpers already in the `page.evaluate` body:

- `resolveBg(expr)` (line 227) — resolves a colour expression the way the page would, creating and
  removing its own throwaway node per call. Use it instead of hardcoding per-mood hexes.
- `wantPaper(pct)` (line 242) — the mood-derived paper for the active skin.
- `norm` / `dead` / `distinct` in the assertion scope — whitespace-insensitive compare, "is this
  colour fully transparent", and distinct-value count.
- `const doodleSkin = skin === "doodle"` — the established skin-aware assertion pattern. The
  house style is to **invert** a doodle claim for atlas rather than skip it: "one uniform radius"
  is exactly as falsifiable as "3+ distinct hand-drawn corners".

---

## 7. Phase 5 work plan — remaining routes, three batches

Same atlas material pass as Phases 2–4, using the §4.4 pattern. Current section anchors in
`components.css` (verified 2026-08-21):

### Batch A — analytics, AI insights, goals, sessions, calendar — ✅ DONE 2026-08-21

All four gates green after it (harness PASS / 70 runs, `tsc --noEmit` clean, lint 0 errors + the 3
pre-existing `no-location-assign-relative-destination` warnings, vitest 122/122). The atlas summary
line now reads `batchA=max1px/44sel  ana=1px/nomarks/2noline/cell1corner`.

Landed as: two additions to the shared card-family block at `components.css:5513` (`.analytics-panel`,
`.insight-card` — they had to go there because `:root[data-mood="cosmic"]` owns them at (0,3,0)), and
one appended block at the end of `components.css` for everything else. Nine harness edits, incl. a new
`P5_SELECTORS` list of 44 surfaces measured two-sidedly per skin (doodle ≥2px, atlas ≤1px).

Two deviations from the plan below, both deliberate:

1. **Note 3 was inverted, not honoured.** Atlas sets `background-image: none` on `.analytics-panel`,
   `.analytics-wide-panel::after`, `.analytics-ai-panel` and `.analytics-ai-icon::after`. Those corner
   marks are baked-in mood-blind hexes (`#38BDF8`/`#FBBF24`/`#F472B6`, and `#263D5B`/`#F59E0B`/`#EC4899`
   in the cosmic twin) and `.dashboard-card` in the same family already drops them under atlas. The
   `panelMarks`/`aiMarks` assertions were **inverted per skin** rather than deleted, per §6 house style.
2. **`--stroke-strong`, not a `--primary` tint, on `.calendar-copy-box button` / `.day-drawer-add button`.**
   Both carry a literal `2px solid var(--secondary)` no remap reaches, so `border-color` alone left them
   at 2px and `p5Bad` caught it in all 30 atlas combos. The fill under them is already `--primary`, so a
   primary-mixed rim renders as no rim.

Follow-ups found and deliberately left (each needs a base-rule edit, i.e. changes doodle too):

- `.calendar-event.task` / `.session` / `.plan` use physical `border-left: 3px`, so the accent spine
  lands on the wrong edge in RTL.
- `.primary-button` / `.secondary-button` keep `2px solid var(--secondary)` under atlas — no atlas rule
  and no token remap reaches them, because the width is a literal. Every filled button in the app is
  still ink-outlined. That is a global control pass, not a page batch.

| Section | Line |
|---|---|
| Analytics command center | 5719 |
| AI Insights notebook | 5959 |
| Goal Creation Form | 6107 |
| Sessions History | 7976 |
| Subtasks & Detail Notes | 8042 |
| Calendar & Planner | 8089 |
| Calendar source switch / Copy to tasks | 10603 |

Also in Batch A:

- **recharts stroke colours onto palette tokens.** The harness already compares chart ink across
  moods (`CHART_INK`, line 169) precisely because six hardcoded hexes once painted `#263D5B` ink
  onto the `#182234` card of the one dark mood. Anything still hardcoded goes to
  `var(--primary)` / `var(--accent)` / `var(--success)` — but see §4.6 on `--accent`.
- **The analytics pen lines.** `.analytics-wide-panel` / `.analytics-ai-panel` draw a second
  dashed `::after` pen line. Atlas should hide them, and that needs three coordinated edits:
  1. `harness:859` — the analytics `ringsMissing` predicate is a **second copy** that still lacks
     the `r.display === "none"` check the notebook copy at line 643 has. Without it the assertion
     confirms a dashed ink line on a pseudo-element that is `display: none`.
  2. `harness:1592` — `if (ana.ringsMissing.length) …` must become skin-aware (doodle: empty;
     atlas: all frames missing), mirroring the notebook version at `harness:1445–1451`.
  3. Keep `ana.panelMarks` / `ana.aiMarks` non-`none` — those corner marks are a
     `background-image` and are asserted at every width. Use `background-color` under atlas.

### Batch B — social, challenges, exam plans, leaderboards

| Section | Line |
|---|---|
| Leaderboards & Challenges | 5110 |
| Remaining route surfaces — Doodle treatment | 5126 |
| Friends & Accountability | 6305 |
| Challenge Composer | 6629 |
| Challenge status chip | 7121 |
| Challenge list | 7169 |
| Challenge detail & result | 7345 |
| Exam Plans | 8500 |
| Plan Forum | 9887 |
| AI Exam Plan | 10787 |

`.friend-card`, `.goal-card`, `.metric-card`, `.stat-card` get the glass treatment consistent with
the bento rhythm. **Revisit the `.metric-card` / `.stat-card` / `.goal-card` pastel `nth-child`
colour rotation** — a fixed pastel cycle is mood-blind and is the same class of fault as the
"always green" task paper the user complained about.

Note `tokens.css:241`: there is an existing comment warning that source order decides any
`[data-skin="atlas"] .public-challenge-card` rule at equal specificity. Read it before touching
the public challenge card.

`.exam-view-tabs` is **already reskinned** (both the container and the `[aria-selected="true"]` pill) —
Batch A did it because the base rule at `:10661` groups it with `.calendar-source-tabs`, and splitting
one component's material across two batches buys nothing. Don't write it twice.

### Batch C — settings, launch/errors, editor panel, wizard, auth

| Section | Line |
|---|---|
| Launch State & Errors | 8693 |
| Editor Panel & Form Layouts | 8717 |
| Wizard Styles | 8825 |
| Settings Hub | 8907 |
| `src/styles/auth.css` | whole file |

The Settings **skin toggle is already built** — Batch C is only the material pass over the
settings hub chrome.

### Known cleanup items to fold in

- **Real duplicate:** `.task-conversion-confirmation` is defined twice with different intent —
  `components.css:8684` (dashed-border panel) and `:11484` (grid). Both apply; the later wins on
  `display`. Consolidate.
- Not duplicates, leave alone: `.subjects-scroll` at 1520/2570 and `.task-meta` at 6062/6072 are
  intentional additive rules with comments explaining themselves.

---

## 8. Assertions Phase 5 must not break

The harness now encodes the user's two design corrections. If a Phase 5 change trips these, the
change is wrong — do not weaken the assertion:

- **Task paper is the mood, not the course.** `harness:1312` — every note must paint exactly *one*
  paper and it must equal `wantPaper(14)`. `harness:1457` — the three dashboard task cards must
  paint one paper equal to `wantPaper(12)`. This is the inverse of what these two checks used to
  claim; the old "two courses must paint two different papers" is exactly how the notes ended up
  green in a pink mood. Course identity is asserted separately, on the tag and the spine.
- **No pinboard under atlas.** `harness:1266` — tilt absent and the `::before` present at *every*
  width under atlas (it is no longer tape, it is the course-coloured top edge, and a single-column
  phone is where a course colour is most useful). Doodle keeps its width-branched behaviour.
- **Dashboard columns pack tightly.** `harness:1648` (`stackGaps`) — the vertical distance between
  consecutive cards in a column must equal that column's own `row-gap`, both skins, all widths.
  Current output: `stack16|16of16px` on atlas, `stack24|24of24px` on doodle.
- **Atlas dashboard columns are `display: flex` on a 2-track grid.** `harness:1655`.

---

## 9. Files changed so far (all uncommitted, branch `main`)

```
M prisma/schema.prisma                          M src/app/globals.css
M scripts/css-geometry-check.mjs                M src/app/layout.tsx
M scripts/fixtures/css-geometry.html            M src/app/manifest.ts
M src/app/api/accountability/**                 M src/components/challenges/**
M src/app/api/friends/**                        M src/components/settings/settings-workspace.tsx
M src/app/api/users/search/route.ts             M src/components/social/friends-workspace.tsx
M src/app/challenges/new/page.tsx               M src/components/ui/logo.tsx
M src/app/friends/page.tsx                      M src/components/ui/study-background.tsx
M src/lib/settings/validation.ts                M src/styles/{auth,components,shell,tokens}.css
?? public/icon-maskable.svg  ?? src/app/icon.svg
?? src/lib/settings/study-skin.ts  ?? src/lib/social/queries.ts  ?? .claude/
```

`src/app/dashboard/page.tsx`, `src/components/sessions/focus-workspace.tsx` and
`src/components/ui/study-background-selector.tsx` are also modified.

---

## 10. If the user reports a runtime error

`PrismaClientValidationError` on the `skin` field means the running `next dev` is still holding
the pre-`db push` Prisma client. **Tell them to restart `next dev` themselves** — do not kill it.
