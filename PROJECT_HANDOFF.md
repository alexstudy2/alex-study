# Alex Study — Project Handoff

Use this file to continue the project in a fresh conversation without losing the decisions and completed work from Phases 1–11.

## New-conversation kickoff

Paste this prompt into the new conversation:

> Read `PROJECT_HANDOFF.md` and `IMPLEMENTATION_PLAN.md` completely, then read the applicable design skills under `.agents/skills/`. Phases 1–11 are complete. Continue with deployment configuration, live acceptance testing, and maintenance only. Preserve all final decisions in the handoff and do not reimplement completed work.

## Project identity

- Product: **Alex Study**.
- Audience: students of the Faculty of Medicine, Alexandria University only.
- Full release scope: all original phases 0–11; no MVP reduction.
- UI languages: Arabic and English using `next-intl`.
- Arabic must use RTL and English LTR throughout navigation, forms, charts, and timer displays.
- User language is persisted in `UserPreference.locale`.
- Default timezone and all daily/weekly boundaries: `Africa/Cairo`.
- Week starts Sunday (`weekStartsOn = 0`).
- Visual/design guidance comes from `.agents/skills`, especially:
  - `ui-ux-pro-max`
  - `design-system`
  - `ui-styling`
- Required UI principles: semantic design tokens, deliberate styling, mobile-first layouts, dark mode, visible focus, reduced motion, accessible touch targets, keyboard support, and no generic default-shadcn appearance.

## Final infrastructure decisions

- Next.js App Router, React, TypeScript, Tailwind CSS.
- Hosting: Vercel Hobby/free tier.
- Database: Supabase free PostgreSQL.
- ORM: Prisma 6.19.x.
- Authentication: Auth.js credentials provider only; no Google OAuth.
- Primary login identifier: college ID.
- Realtime: Supabase Realtime.
- Rate limits/locks: Upstash Redis free tier.
- Email: Gmail SMTP through Nodemailer and an app password.
- Scheduling: Supabase `pg_cron`/Edge Functions plus daily Vercel Cron.
- AI: Groq via OpenAI-compatible SDK.
- AI model: `openai/gpt-oss-120b`.
- Charts: Recharts.
- Client UI state: Zustand.
- Server state: TanStack Query.
- Product analytics: internal metric tables only; no PostHog.
- Optional monitoring: Sentry free tier if quotas are suitable.
- Free-tier service usage must be logged through `ServiceUsageLog` and features should degrade gracefully when credentials or quota are unavailable.

## AI requirements

- Groq is configured in `src/lib/ai/groq.ts`.
- All calls must remain server-only.
- Validate structured responses with Zod before persistence.
- Rate-limit and log usage.
- AI cannot resolve challenges or automatically commit tasks.
- Natural-language task parsing must produce an editable proposal that the student explicitly confirms.
- AI content must display an AI label and allow dismissal/opt-out.
- AI context is retained for 30 days and then purged.

## Auth and privacy decisions

- Registration fields:
  - Full name
  - Academic year 1–6
  - Unique college ID
  - Password
  - Optional recovery email
- Password recovery uses email when available.
- Students without an email submit a manual reset request for admin review.
- Analytics consent is required on first login.
- Account deletion and JSON export must be added in later settings work.
- Default profile visibility: college only.
- Leaderboard statistics are opt-out.
- Public challenge cards show first name and academic year only; full name is opt-in and college ID is never shown.

## Competitive product rules

- Challenge resolution is selected at creation:
  - First to target
  - Highest at deadline
- A task counts competitively only when `estimatedMinutes >= 10`.
- At most one task from the same user counts every five minutes.
- Edits/deletions recalculate progress using adjustment events.
- Manual sessions count for personal analytics only, never leaderboards/challenges.
- “Global” leaderboard is named **All College Students** and can filter by academic year.
- Room capacity is 25.
- Room messages are retained for 30 days.
- Accountability reminders use in-app delivery plus email when available.
- Focus Score formula:

```text
(actual minutes / planned minutes) × 60
+ (1 − distraction rate) × 40
```

- Cap Focus Score at 100 and explain the formula in an in-app help page.

## Phase 1 — complete

Delivered:

- Next.js 16 App Router scaffold.
- React 19, strict TypeScript, Tailwind CSS, ESLint, Prettier.
- Core dependencies for Prisma, Auth.js, Supabase, Groq, Nodemailer, Zustand, TanStack Query, Zod, Recharts, `next-intl`, and testing.
- English/Arabic message catalogs and root `lang`/`dir` handling.
- Environment validation and `.env.example`.
- Groq client with the required model.
- Optional Supabase client that returns `null` when credentials are absent.
- Initial accessibility/design-token styling foundation.
- Scripts for lint, type checking, formatting, build, Prisma, seed, and tests.

Verified:

- Lint passed.
- TypeScript passed.
- Production build passed.

## Phase 2 — complete

Delivered:

- Prisma schema and initial SQL migration:
  - `prisma/schema.prisma`
  - `prisma/migrations/202608140001_phase2_foundation/migration.sql`
- Models currently implemented:
  - User
  - UserPreference
  - UserConsent
  - PasswordResetToken
  - ManualPasswordResetRequest
  - Subject
  - Task with self-related subtasks and JSON recurrence rule
  - StudySession
  - Goal
  - Room and RoomMember
  - Friendship
  - Challenge and ChallengeProgress
  - AIInsight
  - DailyUserMetric
  - ServiceUsageLog
- College-ID credentials authentication using JWT sessions.
- Auth.js session typings containing user ID, college ID, academic year, role, and locale.
- Registration API and UI.
- Sign-in UI.
- Optional-email password recovery.
- Manual password-reset request path.
- Hashed, expiring, one-use password-reset tokens.
- Analytics-consent onboarding.
- Protected dashboard helper and admin authorization helper.
- Initial responsive auth styling.
- Seed data with four students, subjects, tasks, sessions, friendship, lobby, active challenge, goal, and AI insight.
- Authentication validation tests.

Important paths:

- Auth options: `src/lib/auth/options.ts`
- Auth guards: `src/lib/auth/session.ts`
- Auth validation: `src/lib/auth/validation.ts`
- Auth API routes: `src/app/api/auth/`
- Auth pages: `src/app/(auth)/`
- Consent route: `src/app/api/me/consent/route.ts`
- Prisma singleton: `src/lib/db/prisma.ts`
- Seed: `prisma/seed.ts`
- Tests: `tests/auth-validation.test.ts`

Verification completed:

- `prisma validate` passes when `DATABASE_URL` is supplied.
- Prisma client generation passes.
- Initial migration SQL generation passes without a live database.
- Four authentication tests pass.
- ESLint passes.
- TypeScript passes.
- Production build passes.

## Known limitations and technical debt

- Supabase credentials have not been configured, so the migration and seed have not been applied to a live database.
- Demo seed login after database setup:
  - College ID: `MED-2026-001`
  - Password: `AlexStudy2026!`
- Gmail recovery needs `SMTP_USER` and `SMTP_APP_PASSWORD`.
- Manual reset requests are persisted, but the admin review UI is deferred to later administration/settings work.
- Phase 2 UI copy is mostly English; complete Arabic catalogs and language-switch UI remain necessary.
- The `package.json#prisma` seed property produces a Prisma deprecation warning but remains functional with Prisma 6.
- `npm audit` reports Nodemailer advisories inherited through Auth.js. A forced breaking upgrade was deliberately not applied. Review this again during Phase 11/security hardening.
- No free-tier usage ceiling was hit during Phases 1–2.
- There may be an isolated `alex-study-temp/.git` directory left by the initial scaffold. It is unrelated to the application and should only be removed after explicitly verifying the path and intent.
- Phase 2 intentionally implemented the persistence surface needed now. Some detailed tables in the original plan—such as challenge progress events, timer runs, recurrence-rule normalization, messages/reactions, detailed AI jobs, notification delivery, and leaderboard snapshots—must be introduced with their corresponding feature migrations in later phases.

## Phase 3 objective

Build complete task management:

- Authenticated `/tasks` page and `/tasks/[taskId]` detail route.
- Subject management needed by tasks.
- Task CRUD with:
  - title
  - notes
  - subject/tag
  - priority
  - due date
  - estimated minutes
  - status
- Subtasks.
- Daily and weekly recurring tasks.
- Today, This Week, Overdue, and Completed filters using `Africa/Cairo` and Sunday week boundaries.
- Drag-and-drop prioritization using `@dnd-kit`.
- Keyboard and button-based reorder alternative.
- Bulk actions.
- Soft deletion.
- Groq natural-language quick-add using `openai/gpt-oss-120b`.
- Parsed quick-add must create an editable draft, not a task, until explicit confirmation.
- Add task/subject APIs from the implementation plan with Zod validation and ownership checks.
- Add tests for date filtering, recurrence, authorization, task validation, reorder behavior, and AI-draft confirmation.
- Add bilingual English/Arabic task strings and correct RTL behavior.
- Preserve intentional, non-generic visual styling and accessible empty/loading/error states.

## Required Phase 3 process

1. Read `IMPLEMENTATION_PLAN.md` and this handoff completely.
2. Read applicable `.agents/skills` instructions before UI work.
3. Inspect current code before changing it.
4. Implement only Phase 3, preserving completed Phase 1–2 work.
5. Verify Prisma schema/migration, tests, lint, typecheck, and production build.
6. Finish with:
   - Work summary
   - Verification performed
   - Current limitations
   - Next phase: Phase 4 timer and session tracking

## Continuation status - authoritative

This section supersedes the stale new-conversation kickoff, Phase 3 objective, required Phase 3 process, and Phase 1-2 limitation wording above. All final infrastructure, privacy, competitive, AI, product, and design decisions elsewhere in this handoff remain authoritative.

Phases 1-3 are complete. The next conversation must read `PROJECT_HANDOFF.md` and `IMPLEMENTATION_PLAN.md` completely, read the applicable design skills under `.agents/skills/`, and start Phase 4: timer and session tracking. Preserve all completed Phase 1-3 work and final project decisions. Do not reimplement completed work.

## Phase 3 - complete

Phase 3 delivered complete authenticated task management:

- Authenticated `/tasks` and `/tasks/[taskId]` routes.
- Ownership-scoped subject and task APIs with Zod validation.
- Task CRUD, subtasks, daily and weekly recurrence, bulk actions, soft deletion, complete/reopen behavior, and persistent ordering.
- Cairo-aware Today, This Week, Overdue, and Completed filters with Sunday week boundaries.
- Pointer and keyboard ordering with `@dnd-kit`, plus explicit up/down alternatives.
- Groq natural-language quick-add using `openai/gpt-oss-120b`.
- Parsed quick-add output persists as a `TaskDraft`; a task is created only after explicit confirmation.
- Groq usage is recorded through `ServiceUsageLog`, with graceful behavior when `GROQ_API_KEY` is absent.
- Responsive bilingual English/Arabic task UI with RTL, loading, error, empty, focus, and reduced-motion states.

Dependencies added:

- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- `date-fns`
- `date-fns-tz`

Persistence added in `prisma/migrations/202608140002_phase3_tasks/migration.sql`:

- `TaskDraftStatus` and `TaskDraft`.
- `Task.recurrenceSourceId` and `Task.recurrenceDate`.
- Recurrence duplicate constraint and supporting indexes.

Important Phase 3 paths:

- Task routes: `src/app/tasks/`
- Task UI: `src/components/tasks/`
- Task APIs: `src/app/api/tasks/`
- Subject APIs: `src/app/api/subjects/`
- Task domain logic: `src/lib/tasks/`
- Tests: `tests/tasks.test.ts`

Phase 3 verification completed:

- Prisma client generation, formatting, and validation passed.
- 13 tests across 2 files passed.
- ESLint passed.
- Strict TypeScript checking passed.
- Next.js 16 production build passed.
- Phase 3 files were formatted without rewriting unrelated work.

## Current limitations after Phase 3

- Phase 2 and Phase 3 migrations and seed data have not been applied to live Supabase because credentials are absent.
- Authentication and onboarding remain mostly English. The task UI is bilingual, but the complete application language switch is still needed.
- Groq quick-add requires `GROQ_API_KEY`; the standard task form works without it.
- Repository-wide Prettier includes `.agents` and older files that produce warnings. Phase 3 scoped files are formatted.
- Vitest emits an ESM configuration warning for the future Vite native loader.
- The Prisma `package.json#prisma` deprecation remains.
- The Nodemailer audit warning remains for later security hardening.
- No free-tier service ceiling was hit through Phase 3.

## Phase 4 objective

Build timer and session tracking:

- Authenticated `/focus`, `/sessions`, and `/sessions/[sessionId]` routes.
- Configurable Pomodoro focus, short-break, and long-break durations sourced from user preferences.
- Optional task and subject links using Phase 3 data.
- A persisted active timer based on authoritative server timestamps.
- Pause, resume, complete, cancel, and interrupted-session recovery flows.
- Correct behavior across refreshes, device sleep, closed tabs, timezone boundaries, and client clock drift.
- Focus Mode with an appropriately restrained, distraction-free timer experience.
- Distraction recording during sessions.
- Ambient sound controls that respect browser autoplay rules and accessibility preferences.
- Completion reflection.
- Session log and session detail views.
- Initial Focus Score using the final formula already recorded in this handoff.
- Manual sessions included in personal analytics only and never in competitive calculations.
- Timer and session APIs with Zod validation, ownership enforcement, and concurrency protection.
- Phase 4 timer-run persistence needed for robust recovery, without prematurely implementing lobby synchronization.
- Tests covering lifecycle, recovery, authentication, ownership, distractions, timezone behavior, and Focus Score calculation.
- Bilingual English/Arabic UI with RTL, tabular timer figures, keyboard support, reduced motion, and clear recovery states.

## Required Phase 4 process

1. Read `IMPLEMENTATION_PLAN.md` and this handoff completely.
2. Read the applicable `.agents/skills` instructions before UI work.
3. Read the relevant Next.js version-specific guides in `node_modules/next/dist/docs/` before writing Next.js code.
4. Inspect the existing Phase 1-3 implementation before changing it.
5. Implement only Phase 4, preserving all completed Phase 1-3 work and final decisions.
6. Verify Prisma schema and migration, tests, lint, strict typecheck, and production build.
7. Finish with:
   - Work summary
   - Verification performed
   - Current limitations
   - Next phase: Phase 5 dashboard, goals, and calendar

## Phase 4 implementation status - authoritative

Phase 4 timer and session tracking is complete in the current workspace.

Delivered:

- Authenticated `/focus`, `/sessions`, and `/sessions/[sessionId]` routes.
- Preference-driven focus, short-break, and long-break durations.
- Task and subject linking with Phase 3 ownership boundaries.
- Server-authoritative, persisted solo `TimerRun` records with version checks and a database-enforced single open timer per user.
- Pause, resume, complete, cancel, refresh recovery, closed-tab recovery, and client clock-drift-safe countdown derivation.
- Focus Mode, distraction capture, ambient sound controls with browser-safe user initiation, and completion reflection.
- Session history/detail views with actual/planned duration, source, distractions, reflection, and Focus Score.
- Manual session creation marked `MANUAL`; manual sessions remain personal analytics only and are excluded from competitive calculations.
- Zod validation for timer actions, manual sessions, and distractions, with authentication, ownership, and concurrency protection.
- Bilingual English/Arabic RTL timer and session UI with tabular figures, keyboard-accessible controls, reduced-motion compatibility, loading/error/empty/recovery states, and responsive layouts.

Persistence added in `prisma/migrations/202608140003_phase4_timer_sessions/migration.sql`:

- `TimerMode` and `TimerStatus` enums.
- `TimerRun` with authoritative timestamps, active accumulation, pause state, completion/cancellation timestamps, and optimistic `version`.
- `SessionDistraction`.
- `StudySession.reflection`.
- Supporting ownership, lookup, and recovery indexes plus a partial unique index preventing multiple open timers for one user.

Important Phase 4 paths:

- Timer APIs: `src/app/api/timer/`
- Session APIs: `src/app/api/sessions/`
- Timer/session domain logic: `src/lib/sessions/`
- Focus UI: `src/app/focus/`, `src/components/sessions/focus-workspace.tsx`
- Session UI: `src/app/sessions/`, `src/components/sessions/`
- Tests: `tests/sessions.test.ts`

Verification completed:

- Prisma schema formatting and client generation passed.
- Strict TypeScript passed.
- ESLint passed for `src` and `tests`.
- 21 tests across 3 files passed.
- Next.js 16 production build passed, including all Phase 4 routes.

Current Phase 4 limitations:

- Prisma validation and migration application still require the absent `DATABASE_URL`/Supabase credentials.
- Ambient sound is intentionally a lightweight oscillator fallback until licensed audio assets are added; browser autoplay/accessibility constraints are respected.
- The preference/settings editor for changing Pomodoro values is deferred to the later settings work; Phase 4 reads the existing preference fields.
- Lobby timer synchronization remains deferred as required; Phase 4 only persists solo timer runs.
- The existing repository-wide Vitest ESM warning, Prisma package configuration deprecation, and Nodemailer audit warning remain.

Next phase: Phase 5 dashboard, goals, and calendar.

## Phase 5 implementation status - authoritative

Phase 5 dashboard, goals, and calendar is complete in the current workspace.

Delivered:

- A real authenticated `/dashboard` replacing the Phase 2 placeholder.
- Cairo-aware daily and Sunday-start weekly snapshots for planned versus actual minutes, completed tasks, study time, and average Focus Score.
- Today task attention list, active-goal progress, active timer recovery link, and existing labeled AI insight display.
- Authenticated `/goals` and `/goals/[goalId]` routes.
- Ownership-scoped goal CRUD APIs with Zod validation.
- Study-minute and task-completion goal progress derived from authoritative Phase 3 task and Phase 4 session records within each goal window.
- Goal subject filtering, periods, deadlines, status controls, progress bars, detail explanation, and empty/error states.
- Authenticated `/calendar` route and ownership-scoped `/api/calendar` read model.
- Month, Sunday-start week, and agenda views composed from task due dates and study-session timestamps without duplicating event persistence.
- Cairo-local event grouping and navigation, task/session event links, responsive layouts, keyboard controls, RTL, reduced motion, and bilingual English/Arabic copy.

Important Phase 5 paths:

- Dashboard: `src/app/dashboard/page.tsx`
- Goal APIs: `src/app/api/goals/`
- Goal UI: `src/app/goals/`, `src/components/goals/`
- Goal domain logic: `src/lib/goals/`
- Calendar API: `src/app/api/calendar/route.ts`
- Calendar UI: `src/app/calendar/`, `src/components/calendar/`
- Calendar domain logic: `src/lib/calendar/`
- Tests: `tests/phase5.test.ts`

Phase 5 persistence decision:

- No new migration was required. The existing `Goal` model already contains the approved Phase 5 fields, and calendar events remain derived from `Task` and `StudySession` as their sources of truth.

Verification completed:

- Strict TypeScript passed.
- ESLint passed for `src` and `tests` with no warnings.
- 27 tests across 4 files passed.
- Next.js 16 production build passed with the dashboard, goals, calendar, and new API routes.

Current limitations after Phase 5:

- Live database validation, migrations, and seed application remain unavailable without `DATABASE_URL`/Supabase credentials.
- Goal metric, period, and status fields remain strings in the original Phase 2 schema; Phase 5 validates and narrows them through Zod without adding a migration solely for enum typing.
- Calendar event editing delegates to the canonical task/session detail flows. Direct calendar drag/rescheduling is not part of Phase 5.
- Dashboard uses live aggregate queries; scheduled `DailyUserMetric` rollups and full analytics remain later-phase work.
- Existing Vitest ESM, Prisma configuration deprecation, and Nodemailer audit warnings remain.

Next phase: Phase 6 analytics and AI insights.

## Phase 6 implementation status - authoritative

Phase 6 personal analytics and AI insights is complete in the current workspace.

Delivered:

- Authenticated `/analytics` and `/insights` routes.
- Ownership-scoped analytics aggregation derived from completed personal study sessions and owned tasks only.
- 7/30/90-day ranges, Cairo-local daily grouping, and optional subject filtering through the analytics API.
- Summary metrics for study minutes, planned minutes, task completion, distractions, and average Focus Score.
- Daily study trend, subject distribution, planned-versus-actual, productive-time, activity, task completion, and Focus Score API views.
- Accessible visual summaries with a daily data-table alternative, text labels, tabular figures, responsive layouts, reduced motion, bilingual English/Arabic copy, and RTL.
- Planned analytics routes: `/api/analytics/summary` plus metric routes for study hours, subjects, task completion, planned versus actual, productive times, activity, and Focus Score.
- Ownership-scoped AI insight listing and dismissal.
- Explicitly user-triggered Groq insight generation with `openai/gpt-oss-120b`.
- Structured AI output validation with Zod before persistence.
- AI opt-out through `User.aiNudgesEnabled`, AI labels, dismissal, 30-day purge dates, and graceful `ai_unavailable` behavior without `GROQ_API_KEY`.
- Groq usage logging through `ServiceUsageLog`.
- AI prompts use aggregate personal analytics only, never competitive data, and prohibit diagnosis, shame, comparison, or invented facts.

Important Phase 6 paths:

- Analytics UI: `src/app/analytics/`, `src/components/analytics/`
- Analytics APIs: `src/app/api/analytics/`
- Analytics domain logic: `src/lib/analytics/`
- Insights UI: `src/app/insights/`, `src/components/insights/`
- Insights APIs: `src/app/api/insights/`
- Insight AI validation/generation: `src/lib/insights/ai.ts`
- Tests: `tests/analytics.test.ts`

Phase 6 persistence decision:

- No new migration was required. Existing `StudySession`, `Task`, `Subject`, `AIInsight`, `DailyUserMetric`, and `ServiceUsageLog` persistence supports this phase.
- Current analytics are calculated live from authoritative records. `DailyUserMetric` remains available for later scheduled rollups/backfill and scaling.

Verification completed:

- Phase 6 files formatted with Prettier.
- Strict TypeScript passed.
- ESLint passed for `src` and `tests`.
- 29 tests across 5 files passed.
- Next.js 16 production build passed with all analytics and insight routes.

Current limitations after Phase 6:

- Live database application remains unavailable without Supabase credentials.
- Scheduled daily analytics rollups, backfill scripts, and cron execution remain later operational work; live queries are currently the source of truth.
- AI insight generation requires `GROQ_API_KEY`; analytics remain fully functional without it.
- The analytics UI currently exposes global range selection. Subject-filter support exists in the API and can be surfaced in a later UI refinement.
- Existing Vitest ESM, Prisma configuration deprecation, and Nodemailer audit warnings remain.

Next phase: Phase 7 lobbies and realtime group focus.

## Phase 7 implementation status - authoritative

Phase 7 lobbies and realtime group focus is complete in the current workspace.

Delivered:

- Public and private lobby creation, discovery, joining, membership roles, capacity enforcement, and archived-room filtering.
- Room-synchronized focus timers using the existing `TimerRun` model, server timestamps, optimistic versioning, and one-open-timer-per-room enforcement.
- Owner/moderator timer controls with regular-member read-only access.
- Member heartbeat/presence metadata through `RoomMember.lastSeenAt` and five-second polling as the credential-free realtime fallback.
- Thirty-day retained room chat with membership and chat-enabled authorization.
- Room reactions and room-linked session reaction persistence.
- Lobby pages for browsing, creating, joining, room focus, and settings.
- Phase 7 Prisma migration: `prisma/migrations/202608140004_phase7_lobbies/migration.sql`.

Important Phase 7 paths:

- Lobby APIs: `src/app/api/lobbies/`
- Lobby UI: `src/app/lobbies/`, `src/components/lobbies/`
- Lobby domain logic: `src/lib/lobbies/`
- Tests: `tests/lobbies.test.ts`

Verification completed:

- Prisma format and client generation passed.
- Strict TypeScript passed.
- ESLint passed for `src` and `tests`.
- 33 tests across 6 files passed.
- Next.js 16 production build passed.

Current limitations after Phase 7:

- Live migration/database validation remains unavailable without Supabase credentials.
- Polling is the active realtime fallback; optional Supabase Realtime presence/broadcast wiring remains deployment configuration work.
- Expanded moderation, host transfer, invite-code joining, room activity leaderboard, and group challenge mechanics remain scheduled for their dedicated follow-up phases where applicable.
- Existing Vitest ESM, Prisma configuration deprecation, and Nodemailer audit warnings remain.

Next phase: Phase 8 friends, notifications, and accountability.

## Phase 8 implementation status - authoritative

Phase 8 friends, notifications, and accountability is complete in the current workspace.

Delivered:

- Authenticated bilingual `/friends` and `/notifications` routes with RTL support, responsive layouts, visible feedback, keyboard-operable controls, and the established Alex Study visual language.
- College-scoped student search by name or college ID while never returning college IDs in search results.
- Canonical unordered friendship keys preventing duplicate or reversed relationships.
- Friend request creation, incoming/outgoing request states, accept, decline, remove, and block flows with ownership enforcement.
- Blocking ends any pending or active accountability pairing for the same two students and prevents blocked users from appearing in one another's search results.
- In-app notifications for friend requests, accepted friendships, accountability invitations, accepted pairings, and accountability reminders.
- Notification listing with unread state, individual read actions, read-all, pagination cursor support, and notification preference controls.
- Auditable per-channel notification delivery records for in-app and email outcomes, including skipped delivery when SMTP or a recovery email is unavailable.
- Opt-in accountability invitations restricted to accepted friends, mutual acceptance, active/paused/ended states, and participant-only controls.
- A `CRON_SECRET`-protected accountability reminder job using completed study sessions as its source of truth.
- Supportive reminders after 24 hours without a completed session, capped to one reminder per inactive student per accountability pair every 24 hours.
- Accountability reminders respect both students' accountability preference and the recipient's in-app/email channel preferences.
- Gmail SMTP email delivery reuses the existing Nodemailer infrastructure and degrades gracefully when credentials are absent.
- Phase 8 seed data demonstrating an accepted friendship, active accountability pair, and delivered in-app notification.

Persistence added in `prisma/migrations/202608140005_phase8_social_notifications/migration.sql`:

- Canonical `Friendship.pairKey`, block ownership metadata, and relationship indexes.
- `AccountabilityStatus`, `NotificationChannel`, and `DeliveryStatus` enums.
- `AccountabilityPair` and per-subject `AccountabilityCheck` records.
- `Notification` and `NotificationDelivery` records with read and channel-delivery state.

Important Phase 8 paths:

- Friends UI: `src/app/friends/`, `src/components/social/`
- Notifications UI: `src/app/notifications/`, `src/components/notifications/`
- Friends/user-search APIs: `src/app/api/friends/`, `src/app/api/users/search/`
- Accountability APIs/job: `src/app/api/accountability/`, `src/app/api/internal/jobs/accountability-reminders/`
- Notification APIs/preferences: `src/app/api/notifications/`, `src/app/api/me/notifications/`
- Domain logic: `src/lib/social/`, `src/lib/notifications/`, `src/lib/accountability/`
- Tests: `tests/social.test.ts`

Phase 8 verification completed:

- Prisma schema formatting and client generation passed.
- Prisma schema validation passed using the standard non-connecting local validation URL because live Supabase credentials remain absent.
- Scoped Prettier checks passed for all changed TypeScript/CSS files; Prisma formatted the schema and the SQL migration remains hand-authored.
- Strict TypeScript passed.
- Repository ESLint passed with no warnings.
- 39 tests across 7 files passed.
- Next.js 16.3 production build passed and generated all Phase 8 pages and route handlers.

Current limitations after Phase 8:

- The Phase 8 migration and seed have not been applied to live Supabase because `DATABASE_URL` credentials are absent.
- Email delivery requires `SMTP_USER`, `SMTP_APP_PASSWORD`, and a recipient recovery email. Missing SMTP configuration is recorded as a skipped delivery while in-app delivery remains available.
- The scheduled reminder route requires deployment configuration for `CRON_SECRET` and a daily Supabase/Vercel scheduler invocation.
- Supabase Realtime user-channel broadcasts are not required for correctness; notifications currently use canonical persistence plus page/API refresh, with realtime wiring remaining deployment configuration work.
- Friend and notification navigation is available from the Phase 8 pages themselves; a unified global application shell/notification badge remains part of later settings and launch-polish work.
- Email notification copy is currently English while the in-app friends and notification workspaces are bilingual.
- Browser push notifications remain intentionally out of scope due to service-worker/provider complexity.
- Existing Vitest ESM configuration warning, Prisma package configuration deprecation, and Nodemailer audit warning remain for Phase 11 hardening.

Next phase: Phase 9 1v1 challenges and All College Students/friends leaderboards, preserving the approved competitive eligibility, privacy, resolution, adjustment-event, and Cairo/UTC boundary rules.

## Phase 9 implementation status - authoritative

Phase 9 one-to-one challenges and weekly leaderboards is complete in the current workspace.

Delivered:

- Authenticated bilingual `/challenges`, `/challenges/new`, `/challenges/[challengeId]`, `/challenges/[challengeId]/result`, and `/leaderboard` routes with RTL support, responsive layouts, route loading/error states, keyboard-operable controls, and the established Alex Study visual language.
- Public bilingual `/share/challenges/[shareToken]` result cards selected from the request language, with first-name-plus-academic-year identity by default and no college IDs or internal UUIDs in the public payload.
- Friend-only one-to-one challenge creation with selectable task count, study time, subject task count, or subject study time goals.
- Selectable `TARGET_FIRST` and `DEADLINE_LEADER` resolution, scheduled starts, maximum 31-day duration, invite acceptance/decline, participant cancellation, history, statistics, results, rematches, and share-token rotation.
- Competitive eligibility from authoritative owned tasks and study sessions only: parent tasks estimated at least 10 minutes, at most one eligible task every five minutes, timer/room sessions only, no manual sessions, and normalized subject matching.
- Transactional reconciliation with append-only, idempotent source and adjustment events. Task/session edits, reopenings, deletions, and restored eligibility recalculate progress, final values, results, and badges.
- Target-first wins and simultaneous-target draws; deadline leading totals and exact-total draws; target-first expiration when neither participant reaches the target before the deadline.
- Twelve-second visible-page challenge polling, server-time-derived countdowns, labeled progress bars, live status announcements, and an auditable adjustment timeline.
- Challenge notification support for invites, accepts, declines, cancellations, resolutions, and expired target windows, with the Phase 8 in-app/email delivery and preference system.
- Challenge finisher, leading-result milestone, target-reached, and five-completion consistency badges. Challenge-scoped awards and the aggregate consistency badge are revoked when later corrections invalidate them.
- Weekly All College Students and accepted-friends leaderboards for eligible study minutes or eligible task completions, with academic-year filtering for the college scope.
- Monday 00:00 UTC leaderboard boundaries, equal-primary-total ranks, supportive ranking language, and immediate user opt-out across both scopes. Cairo remains the normal personal planning/analytics boundary.
- Live leaderboard GET responses without write side effects; `CRON_SECRET`-protected weekly jobs persist global/year/friend snapshot records for operations and history.
- Idempotent task-completion timestamps so repeated completion requests cannot move an already competitive source into a later challenge window.
- Dashboard/friends navigation to challenges and leaderboards, plus surfaced challenge notification preferences.
- Phase 9 seed states for pending, active, completed/public challenges, accepted friends, normalized matching subjects, authoritative eligible task/session sources, manual/short-source exclusions, badge awards, and a leaderboard opt-out user.

Persistence added in `prisma/migrations/202608140006_phase9_challenges_leaderboards/migration.sql`:

- `SCHEDULED` and `EXPIRED` challenge states.
- Challenge subject snapshots, acceptance/resolution/cancellation fields, rematch relationship, and share enablement.
- `ChallengeProgressEvent` with source/adjustment types and unique idempotency keys.
- Badge definitions and user badge awards.
- Weekly leaderboard snapshots and ranked entries.
- Backfill of subject snapshots and accepted/resolved timestamps for existing challenge rows.

Important Phase 9 paths:

- Challenge UI: `src/app/challenges/`, `src/components/challenges/`
- Public cards: `src/app/share/challenges/`, `src/app/api/public/challenges/`
- Leaderboard UI: `src/app/leaderboard/`, `src/components/leaderboards/`
- Challenge APIs: `src/app/api/challenges/`
- Leaderboard/privacy APIs: `src/app/api/leaderboards/`, `src/app/api/me/privacy/`
- Scheduled jobs: `src/app/api/internal/jobs/challenges/`, `src/app/api/internal/jobs/weekly-leaderboards/`
- Challenge/leaderboard domain logic: `src/lib/challenges/`, `src/lib/leaderboards/`
- Migration: `prisma/migrations/202608140006_phase9_challenges_leaderboards/migration.sql`
- Tests: `tests/challenges.test.ts`

Phase 9 verification completed:

- Prisma schema formatting, client generation, and schema validation passed. Validation used the standard non-connecting local PostgreSQL URL because live Supabase credentials remain absent.
- The complete Phase 9 change set passed a scoped Prettier check.
- Strict TypeScript passed.
- Repository ESLint passed with no warnings or errors.
- 51 tests across 8 files passed, including 12 new Phase 9 tests for eligibility, throttling, manual-session exclusion, subject matching, adjustment/re-resolution behavior, winners/draws/expiration, UTC weekly boundaries, tied ranks, validation, and public-name sanitization.
- Next.js 16.3 production build passed and generated all Phase 9 pages, APIs, public routes, and scheduled-job routes.

Current limitations after Phase 9:

- The Phase 9 migration and updated seed have not been applied to live Supabase because `DATABASE_URL`/`DIRECT_URL` credentials are absent.
- Challenge lifecycle resolution requires deployment scheduling for `POST /api/internal/jobs/challenges`; the UI/API also reconciles on relevant reads and source mutations, but the scheduler is required for deadline resolution without user traffic.
- Weekly leaderboard snapshot persistence requires deployment scheduling for `POST /api/internal/jobs/weekly-leaderboards`; leaderboard pages remain correct because they derive the current week live from authoritative records.
- Challenge email delivery requires the existing `SMTP_USER`, `SMTP_APP_PASSWORD`, and recipient recovery-email configuration; absent SMTP is recorded as skipped while in-app notifications remain available.
- Supabase Realtime challenge broadcasts remain optional deployment work. Correctness currently uses canonical persistence with the documented 12-second polling fallback.
- Public result cards are responsive HTML rather than downloadable raster images. Browser sharing/printing is available; image export can be added during launch polish if required.
- Repository-wide `npm run format:check` still reports pre-existing formatting in `.agents` skill packages and older Phase 2/auth/config files outside Phase 9. Those unrelated files were intentionally not rewritten; every Phase 9-touched file passes Prettier.
- Existing Vitest ESM configuration and Prisma package-configuration deprecation warnings remain for Phase 11 hardening.

Next phase: Phase 10 AI insights and exam planner, while preserving the rule that AI never determines challenge winners or commits tasks without explicit user confirmation.

## Phase 10 implementation status - authoritative

Phase 10 deterministic AI insights and the editable exam planner are complete in the current workspace. The stale Anthropic wording in `IMPLEMENTATION_PLAN.md` is superseded by the established Groq decision in this handoff: all Phase 10 generation uses `openai/gpt-oss-120b` through the server-only OpenAI-compatible Groq client.

Delivered:

- Deterministic personal-data signals for weekly recaps, performance drops, conservative workload/burnout risk, evidence-backed best-time suggestions, and daily tips. Signal detection uses aggregate owned task/session data only; Groq writes the supportive explanation after a signal exists.
- No competitive data enters AI context, and AI has no role in challenge eligibility, progress, resolution, badges, or leaderboards.
- Audited `AIJob` execution with stable input hashes, idempotent job keys, prompt/model attribution, stale-running detection, at most two attempts, structured error codes, and per-attempt usage records.
- Cairo-local daily AI ceilings: 40,000 tokens per user, 250,000 shared tokens, six jobs per user, and stricter per-type limits including two daily tips, one recap/detector result per type, and two exam plans.
- Groq prompt version `phase10-v1`, strict Zod response validation, token input/output logging, graceful `ai_unavailable` behavior, AI labels, dismissal, global AI opt-out, and AI insight notification preference support.
- `CRON_SECRET`-protected `ai-recaps`, `performance-detection`, `burnout-detection`, and `cleanup` routes using the shared constant-time authorization helper.
- Thirty-day AI-context retention. Expired insights are deleted and raw exam syllabus text is nulled with an auditable purge timestamp by the cleanup job.
- Authenticated bilingual `/exam-plans/new` and `/exam-plans/[planId]` experiences with responsive English/Arabic layouts, RTL, semantic tokens, visible feedback, accessible labels, reduced-motion compatibility, recent-plan navigation, and dashboard/Insights entry points.
- Exam-plan generation with strict date, syllabus, item-count, duration, subject, and structured-output validation. Cairo date boundaries remain authoritative.
- Editable proposal titles, summaries, subjects, study dates, durations, notes, item addition/removal, and selective review before any task mutation.
- A separate review step plus literal confirmation checkbox before selected proposal items become owned tasks. Conversion is transactional and idempotent; accepted items and the exam date become immutable after task creation.
- Partial acceptance and rejection semantics: accepted tasks remain canonical tasks, rejecting a proposal closes only the remaining items, and repeated acceptance cannot create duplicate tasks.
- Server-side resulting-plan date validation prevents an exam-date edit from leaving unchanged study items outside the valid today-to-exam window.
- Phase 10 seed states for an audited weekly recap, Groq usage record, partially accepted exam plan, created task, and remaining editable proposal item.

Persistence added in `prisma/migrations/202608140007_phase10_ai_exam_plans/migration.sql`:

- `AIJobStatus` and `ExamPlanStatus` enums.
- `AIJob` audit, idempotency, retry, model, prompt-version, timing, error, and metadata records.
- `ExamPlan` and `ExamPlanItem`, including AI-job ownership, retained/purged syllabus context, proposal lifecycle, subject links, accepted/rejected state, and one-to-one created-task links.
- `AIInsight.aiJobId` and type-aware lookup indexing.
- `ServiceUsageLog` user/job/model/input-token/output-token relationships and indexes.

Important Phase 10 paths:

- AI policy and audited execution: `src/lib/ai/policy.ts`, `src/lib/ai/jobs.ts`, `src/lib/ai/groq.ts`
- Deterministic insights and scheduled work: `src/lib/insights/`, `src/app/api/insights/`, `src/app/api/internal/jobs/ai-recaps/`, `src/app/api/internal/jobs/performance-detection/`, `src/app/api/internal/jobs/burnout-detection/`, `src/app/api/internal/jobs/cleanup/`
- AI preference API: `src/app/api/me/ai/route.ts`
- Exam-plan domain logic and APIs: `src/lib/exam-plans/`, `src/app/api/exam-plans/`
- Exam-plan and insight UI: `src/app/exam-plans/`, `src/components/exam-plans/`, `src/app/insights/`, `src/components/insights/`
- Migration and seed: `prisma/migrations/202608140007_phase10_ai_exam_plans/migration.sql`, `prisma/seed.ts`
- Tests: `tests/phase10.test.ts`

Phase 10 verification completed:

- Prisma schema formatting passed.
- Prisma schema validation passed using the standard non-connecting local PostgreSQL URL because live Supabase credentials remain absent.
- Prisma Client generation passed with Prisma 6.19.x.
- The complete Phase 10 TypeScript/TSX change set passed a scoped Prettier check. Prisma formatted the schema; the hand-authored SQL migration was manually reviewed because this repository has no Prettier Prisma/SQL parser.
- Strict TypeScript passed with `tsc --noEmit`.
- Repository ESLint passed with no warnings or errors.
- 60 tests across 9 files passed, including 9 new Phase 10 tests for Cairo/Sunday recap boundaries, baseline performance detection, conservative workload detection, best-time evidence thresholds, stable hashes, AI cost ceilings, generated-plan validation, exam-window rules, and explicit task confirmation/status derivation.
- Next.js 16.3 production build passed and generated all 68 application pages and route handlers, including the Phase 10 UI, APIs, and scheduled jobs.
- A final responsive/accessibility source review confirmed mobile grid collapse, RTL direction, labeled navigation/forms, keyboard-operable native controls, visible focus, stable control sizing, dark-mode tokens, and reduced-motion coverage. Live browser/data verification still requires a configured database.

Current limitations after Phase 10:

- The Phase 10 migration and updated seed have not been applied to live Supabase because `DATABASE_URL`/`DIRECT_URL` credentials are absent.
- Live Groq generation was not exercised without `GROQ_API_KEY`. AI endpoints and scheduled jobs return a controlled unavailable state while tasks, analytics, challenges, and other non-AI features remain functional.
- The AI/detector/cleanup routes require `CRON_SECRET` plus deployment scheduler configuration. Thirty-day cleanup and unattended scheduled insights do not occur until those invocations are configured.
- Scheduled insight jobs currently process at most the first 100 opted-in users per invocation. Cursor-based batching, timeout/load testing, and operational job dashboards belong in Phase 11 before a larger rollout.
- Generated plans remain suggestions and can contain imperfect study sequencing despite schema validation; the editable review and explicit task confirmation are intentional safety boundaries.
- End-to-end acceptance, retry, cleanup, notification, and task-conversion flows still need live Supabase/Groq testing after deployment credentials are available.
- Repository-wide `npm run format:check` still includes pre-existing formatting drift in unrelated `.agents` packages and older files; all Phase 10-touched TypeScript/TSX files pass the scoped check.
- The existing Vitest native-config ESM warning, Prisma `package.json#prisma` deprecation, and Nodemailer/Auth.js audit warning remain for Phase 11 hardening.

Next phase: Phase 11 hardening and launch polish. Apply all pending migrations and seed to the target Supabase project; configure Groq, SMTP, cron, and optional realtime credentials; run live critical-path end-to-end tests; add cursor-based scheduled-job batching; complete security, rate-limit, accessibility, responsive-browser, performance, backup/restore, and operational audits; resolve dependency/tooling warnings; and refine the unified navigation/settings experience without weakening AI opt-out, 30-day retention, personal-data-only signals, or explicit task confirmation.

## Phase 11 implementation status - authoritative

Phase 11 hardening and launch polish is complete in the current workspace. All planned application phases 1–11 are implemented; remaining work is deployment configuration and live-environment acceptance rather than another product phase.

Delivered:

- A unified authenticated application shell with desktop sidebar, compact tablet rail, mobile bottom navigation and operable overflow menu, active-route state, notification badge, theme cycling, user identity, skip link, RTL labels, stable touch targets, and keyboard-visible focus.
- A bilingual `/settings` workspace for profile, recovery email, academic year, language, theme, Pomodoro defaults, ambient sound, notification categories, profile/leaderboard/public-card privacy, AI opt-out, JSON data export, and password-confirmed account deletion.
- New account APIs: `GET|PATCH|DELETE /api/me`, `PATCH /api/me/preferences`, and `GET /api/me/export`; privacy now includes profile visibility. Account deletion requires the current password plus exact `DELETE` confirmation and signs the browser out after success.
- Bilingual sign-in, registration, password recovery, manual recovery, reset-password, and analytics-consent experiences with password-manager autocomplete, fetch-based feedback, and no raw JSON navigation.
- Forgot-password responses are uniform for unknown accounts, accounts without recovery email, and eligible accounts, removing the prior account/recovery-email enumeration signal.
- Static Content Security Policy and HSTS-in-production plus clickjacking, MIME-sniffing, referrer, permissions, and opener headers in `next.config.ts`.
- Next.js 16 `src/proxy.ts` same-origin enforcement for unsafe browser API methods while preserving origin-less cron/server calls.
- Reusable fixed-window rate limiting with optional Upstash REST persistence and process-local fallback. Limits cover credential sign-in, registration, password recovery/reset, manual reset, user search, AI task parsing, daily tips, and exam-plan generation.
- Persistent 25-user AI scheduler batching through `ScheduledJobCursor`; recap, performance, and workload detectors advance only after a processed batch and expose `nextCursor`/`cycleCompleted` metadata. Failed batches retry without cursor advancement and existing AI job keys preserve generation idempotency.
- Phase 11 migration: `prisma/migrations/202608140011_phase11_hardening/migration.sql`.
- Prisma configuration moved from deprecated `package.json#prisma` to `prisma.config.ts`; credential-free validation/generation scripts use a local non-connecting placeholder through `cross-env`.
- Vitest configuration moved to native ESM `vitest.config.mts`, removing the earlier native-config warning and isolating unit tests from browser specs.
- Nodemailer upgraded from vulnerable 7.0.13 to security-clean 9.0.5. The application uses compatible stable `createTransport`/`sendMail` APIs and the audit/build pass.
- Launch metadata, manifest, robots exclusion, global error and not-found experiences, root authenticated/sign-in routing, and removal of the default Next.js starter page.
- Playwright plus axe desktop/mobile launch tests, responsive overflow assertions, root routing checks, and cross-origin mutation rejection coverage.
- Operational documentation in `README.md` and `docs/OPERATIONS.md` covering deployment, secrets, scheduler cadence, backup/restore drills, monitoring, privacy, degraded modes, and incident response.

Important Phase 11 paths:

- Shell and providers: `src/components/navigation/app-shell.tsx`, `src/components/providers.tsx`, `src/app/layout.tsx`.
- Settings UI and APIs: `src/app/settings/`, `src/components/settings/`, `src/app/api/me/`, `src/lib/settings/validation.ts`.
- Security: `src/proxy.ts`, `src/lib/http/rate-limit.ts`, `next.config.ts`.
- Scheduler cursor: `src/lib/insights/jobs.ts`, `prisma/schema.prisma`, Phase 11 migration.
- Launch tests: `tests/phase11.test.ts`, `e2e/launch-smoke.spec.ts`, `playwright.config.ts`.
- Operations: `README.md`, `docs/OPERATIONS.md`.

Verification completed:

- Scoped Prettier check passed for every Phase 11-touched source, configuration, test, and documentation file.
- Prisma format, schema validation, and client generation passed with Prisma 6.19.3 and no deprecated package-config warning.
- Strict TypeScript passed.
- Repository ESLint passed with no warnings or errors.
- 63 Vitest tests across 10 files passed; the earlier Vitest ESM/native-config warning is gone.
- 12 Playwright/axe tests passed across desktop Chromium and Pixel 7 emulation. Public auth/recovery routes have no serious/critical axe violations or horizontal overflow; root routing and cross-origin mutation rejection also passed.
- `npm audit` reports 0 vulnerabilities.
- Next.js 16.3 production build passed and generated all 74 application pages/route handlers plus Proxy, manifest, and robots outputs.

Current deployment-only limitations after Phase 11:

- Phase 2–11 migrations and seed still have not been applied to live Supabase because `DATABASE_URL`/`DIRECT_URL` credentials are absent. Apply them in order with `npx prisma migrate deploy` before live testing.
- Live authenticated settings export/deletion, timer persistence, social/accountability, challenge, scheduler-cycle, notification, and retention cleanup acceptance still require the configured Supabase database.
- Live Groq generation, SMTP delivery/recovery, Supabase Realtime broadcasts, Upstash distributed rate limiting, and cron execution remain unverified until their deployment credentials are configured. Each optional service retains the documented controlled fallback.
- NextAuth 4.24.15 declares Nodemailer `^7.0.7` as an optional peer even though patched Nodemailer 9 is API-compatible with the mail calls used here. `npm audit` is clean, TypeScript/tests/build pass, but installation currently needs `npm install --legacy-peer-deps` until NextAuth broadens that optional peer range or the project migrates auth versions.
- Process-local rate limiting is per application instance. Configure Upstash before public/high-traffic rollout for globally coordinated enforcement.
- Browser automation covers credential-free public/auth routes. Protected responsive/browser flows require a seeded live or local PostgreSQL database and should be added to the deployment acceptance run.

Next steps:

1. Provision the target Supabase project, apply all migrations including `202608140011_phase11_hardening`, and seed only the intended non-production environment.
2. Configure and rotate production secrets for Auth, Groq, SMTP, Upstash, Supabase, and cron; verify security headers on the canonical HTTPS hostname.
3. Run the live critical-path acceptance checklist in `docs/OPERATIONS.md`, including authenticated export/deletion and repeated scheduler invocations until each cursor cycle completes.
4. Establish monitoring/alerts and complete a documented backup restore drill before public launch.
