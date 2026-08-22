# Remediation Plan — Alex Study Production Readiness

**Companion to:** `PRODUCTION_READINESS_AUDIT.md` (43 findings: 1 Critical · 8 High · 15 Medium · 19 Low)
**Goal:** resolve every finding in dependency order, with acceptance criteria per task and zero big-bang risk.
**Total estimate:** ~5.5–6.5 focused developer-days. Phases 0–1 alone clear every launch blocker (~2 days).

---

## ⭐ EXECUTION STATUS (2026-08-22)

| Phase | Status | Notes |
|---|---|---|
| 0 Safety net | ✅ DONE | Baseline green; DB reachable; branch `hardening/p0-launch-blockers`; prod build verified |
| 1 Launch blockers | ✅ DONE | T1.1–T1.7 complete; migrations `202608220017_session_version` + `202608220018_fix_user_auth_key` applied (DB baselined; `migration_lock.toml` committed); health endpoint live; gates green |
| 2 Data migrations | ✅ DONE | Snapshot taken first (`backups/snapshot-2026-08-22T*.json`, gitignored). Migration `202608220019_phase2_integrity` applied: H5/H6 SetNull FKs (introspection-verified), H7 purge job + indexes, L14/L15 index bundle, D4 dead-table drop, T3.5b invite-code join gate (uses the previously-dead `Room.inviteCodeHash` column), T3.6b `Challenge.pairKey` backfill + `Challenge_one_live_per_pair` partial unique |
| 3 Security hardening | ✅ DONE | T3.1–T3.11. Nonce-CSP verified in a real Chromium run against the production build. Schema-dependent halves of T3.5 (`Room.inviteCode`) and T3.6 (`Challenge.pairKey` partial unique) **deferred to Phase 2 batch** — serializable-transaction fixes shipped meanwhile |
| 4 Low-severity batch | ✅ DONE | T4.1–T4.12 complete |
| 5 Release gates | ✅ DONE | typecheck/lint/122 unit tests/12 e2e vs production build all green; env contract satisfied locally (all required vars set, lengths OK); deploy smoke passed: single nonce'd CSP, HSTS/XFO/nosniff/COOP present, `/api/health` ok, rate limiter returned exactly one 429 with `Retry-After` on request #6 |

**Findings closed: 43 of 43.** Deferred-by-design items (documented, not defects): forum report affordance, enum promotion for loose String columns, pg_trgm search scaling, weekly-leaderboard O(N) optimisation.

**Still open (deployment steps, not code):** set Vercel env vars (`CRON_SECRET` ≥32 chars is a hard boot requirement now) → merge/push → GitHub secrets `APP_URL` + `CRON_SECRET` → post-deploy smoke → first-week watch (checklist in README "Production Deployment").

---

## 0 · Ground rules

1. **One branch per phase**, PR-reviewed, merged in order. Never mix migrations with app-code-only PRs.
2. **Migrations are forward-only** and bundled per phase (see T2.0 batching policy). Every migration PR includes: the up-SQL, an introspection check against staging/prod *before* apply, and a written rollback note (usually "restore from snapshot taken pre-apply" — PITR is already documented in OPERATIONS.md).
3. **No behavior change rides along silently**: every task lists exactly which finding IDs it closes.
4. **Never run:** `npm audit fix --force` (downgrades Prisma), `prisma db push` against any environment relying on the phase11 partial unique indexes.
5. Each phase ends with the same gate: `npm run typecheck && npm run lint && npm test` green, plus the phase-specific acceptance criteria.

---

## Decision points (defaults chosen — flag before Phase 1 starts to change any)

| # | Decision | Default in this plan | Alternative |
|---|---|---|---|
| D1 | Error reporting provider | Built-in structured logger (`src/lib/observability/logger.ts`) + `captureError()` seams left ready; Sentry can be added later behind `SENTRY_DSN` without touching call sites | Full Sentry SDK now |
| D2 | PRIVATE lobby gating mechanism | `Room.inviteCode` (nullable, unique, auto-generated for PRIVATE rooms; join must present it) | Owner-approval queue (heavier UX) |
| D3 | Enumeration-response strictness | Keep current friendly responses (register 409, `email_in_use`); add timing jitter on miss paths; document accepted risk | Fully uniform "check your inbox" flows |
| D4 | Dead `DailyUserMetric` table | Drop in the Phase-2 migration batch (nothing writes it) | Keep + finish the feature |
| D5 | Dead Supabase realtime client | Delete module + its env entries; recoverable from git history when needed | Keep + mandatory RLS review comment |
| D6 | Unverified email changes | Interim: require password re-confirm on email change; full confirmation-link loop is a separate post-launch feature | Full verification loop now (+0.5–1 day) |

---

## Phase 0 — Safety net (~½ hour)

**T0.1 Baseline & snapshot**
- Confirm `typecheck`/`lint`/`vitest` green (they were at scan time).
- Take a fresh DB snapshot / confirm PITR window covers the migration windows of Phases 1–2.
- Create branch `hardening/p0-launch-blockers`.
- Run `npm run build` once the dev server can be paused (it owns `.next` today) to establish a known-good production build before changes.

---

## Phase 1 — Launch blockers (~1.5 days)

### T1.1 Env guards + boot-time wiring — closes **C1, H1**
Files: `src/lib/config/env.ts`, new `src/instrumentation.ts`, `.env.example`
1. In `env.ts`: compute `isProd = process.env.NODE_ENV === "production"` **before** parsing; for `DATABASE_URL` and `NEXTAUTH_SECRET`, pass `undefined` through when unset instead of the literal fallbacks; make both schemas `.min(1)/.min(32)` non-optional so zod throws at parse time. Keep dev fallbacks applied only when `!isProd`.
2. Extend the schema: `APP_URL`(prod-required, url()), `CRON_SECRET`(prod-required, min 32), `NEXTAUTH_URL`(prod-required, url()). Optional-with-boot-warning tier: `UPSTASH_REDIS_REST_URL/TOKEN`, `SMTP_HOST/PORT/USER/APP_PASSWORD` (log a single structured warning when absent in prod — ties into T1.6).
3. New `src/instrumentation.ts` (`register()` imports `@/lib/config/env`) so the schema executes once per server start regardless of which route is hit first (Next 16 file convention; works on Node runtime).
4. Update `.env.example` with the prod-required markers.
**Accept:** `NODE_ENV=production` build/boot with any required var missing fails loudly at startup; dev unaffected; all routes get validated env.

### T1.2 Dependency alignment — closes **H8**
Files: `package.json`, `package-lock.json`
1. `"nodemailer": "^9.0.5"`; bump `@types/nodemailer` to the matching v9 line (verify it exists; else pin `@latest` and typecheck).
2. `npm install`; confirm `npm ls nodemailer` reports one clean subtree and `npm ls` shows no `invalid`.
3. Re-run mailer-touching tests; send one real test email via the T1.6 logger harness if SMTP vars available.
**Accept:** fresh `npm ci` reproduces the same tree locally and would on Vercel.

### T1.3 Reset-token lifecycle — closes **H3**
Files: `src/app/api/auth/reset-password/route.ts`, `src/app/api/auth/forgot-password/route.ts`
1. `forgot-password`: inside the same transaction that inserts the new token, `passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: <now> } })` — expire outstanding tokens so requests can't stack live links.
2. `reset-password`: replace read-check-write with CAS —
   `updateMany({ where: { tokenHash, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })`; abort with the same generic response when `count === 0`; then in the same tx update the password hash and `deleteMany({ where: { userId } })` all remaining tokens.
   (Keep response text identical to avoid new enumeration signals — D3.)
**Accept:** concurrent double-submit yields exactly one success; after a successful reset, no token for that user redeems; unit tests added for both.

### T1.4 Session revocation — closes **H4**
Files: `prisma/schema.prisma`, new migration, `src/lib/auth/options.ts`, `apiUser()` implementation (`src/lib/tasks/response.ts` or its shared home), `reset-password/route.ts`, `me/route.ts` DELETE
1. Schema: `User.sessionVersion Int @default(0)`; migration adds column with default (non-breaking, instant on Postgres).
2. Stamp at sign-in: jwt callback copies `user.sessionVersion` → `token.sv` on credentials sign-in.
3. Verify per request: `apiUser()` already resolves the DB user for most routes — extend that select with `sessionVersion` and compare to `token.sv`; mismatch ⇒ treat as signed out (return null / trigger `signOut` path). For routes that never touch the DB user row, the existing short-lived-jwt posture plus password-reset revocation is acceptable coverage; note them.
4. Bump `sessionVersion` (increment) inside the T1.3 reset transaction and at the top of the account-delete flow.
5. Set explicit `session: { maxAge: 30 * 24 * 60 * 60 }` so the previous implicit default becomes a deliberate, documented choice.
**Accept:** changing password invalidates all older cookies within one request; unit test covers stale-version rejection.

### T1.5 Auth-key migration reconciliation — closes **H2**
Files: new migration `…_fix_user_auth_key/migration.sql`, `prisma/migrations/migration_lock.toml`, `README.md`
1. Migration SQL: `DROP INDEX "User_collegeId_key"; CREATE UNIQUE INDEX "User_collegeId_academicYear_key" ON "User"("collegeId","academicYear");` — matches `@@unique([collegeId, academicYear])`.
2. Create `migration_lock.toml` with `provider = "postgresql"` (hand-author it; `prisma migrate diff` will respect it thereafter).
3. Pre-apply gate: introspect prod/staging (`prisma db pull` into a scratch schema) and confirm no rows violate the compound constraint (they can't — the stricter global key currently holds).
4. README: replace Quick-Start `db push` instruction with `migrate deploy` (dev may use a clearly-labelled throwaway-sandbox exception); add one paragraph naming the raw-SQL partial indexes and forbidding blind pushes (also closes the M15-doc slice and reinforces M12-doc).
**Accept:** `migrate deploy` on a copy of prod succeeds; `\d "User"` shows exactly the compound unique; README consistent with OPERATIONS.md.

### T1.6 Observability minimum — closes **M5, M6**
Files: new `src/lib/observability/logger.ts`, new `src/app/api/health/route.ts`, `src/app/global-error.tsx`, `.env.example`
1. `logger.ts`: tiny structured sink — `logError(scope, err, meta?)` / `logWarn` writing JSON lines to stderr (Vercel captures stdout/stderr natively) + exported `captureError()` seam that forwards to Sentry when `SENTRY_DSN` exists (D1: SDK itself deferred).
2. `/api/health`: unauthenticated `{ ok: true }` + Prisma `SELECT 1` ping with 2s timeout; never returns row data; cache-disabled.
3. `global-error.tsx`: call `captureError(error)` in the effect (client-safe shim posts nothing in v1 — server errors are captured at their throw sites via the same helper in route handlers' catch paths going forward; retrofit the 3–4 highest-value catch sites: AI jobs, cleanup job, mailer).
**Accept:** killing the DB makes `/health` return 503 within timeout while `/` stays up; an intentional thrown error in a handler appears as structured JSON in Vercel logs.

### T1.7 Draft-accept ownership checks — closes **M2**
File: `src/app/api/tasks/parse/[draftId]/accept/route.ts`
Mirror the exact pattern from `tasks/route.ts:26-39`: if `edits.data.subjectId` present → `subject.findFirst({ where: { id, userId }})` else 400; same for `parentTaskId` against tasks. Reject with the route family's standard validation-error envelope.
**Accept:** cross-user subject/parent UUID in the payload → 400; own IDs still accepted; test added.

**Phase 1 exit gate:** typecheck/lint/tests green; `next build` succeeds; manual smoke: register → sign-in → forgot/reset (old cookies dead) → health endpoint.

---

## Phase 2 — Data-integrity migrations (~½–1 day)

**T2.0 Batch policy:** one migration PR containing T2.1 + T2.2 schema/index changes + T1 leftovers, reviewed together, applied in a single maintenance window (all statements are online-safe: `SET NULL` alters and additive indexes).

### T2.1 Cascade blast-radius fixes — closes **H5, H6**
Migration:
- `LeaderboardSnapshot.ownerUserId` FK → `ON DELETE SET NULL` (drop/re-add constraint).
- `TimerRun.roomId` FK → `ON DELETE SET NULL` (mirrors StudySession.room).
Schema.prisma updated to match. Spot-check queries that assumed non-null owner/room (`leaderboards/service.ts:113`, room timer reads) — both tolerate null by design (owner is provenance metadata; room timers are looked up by roomId value which remains for live rooms).
**Accept:** deleting a test user who owns a room with a member's active timer leaves the TimerRun intact with `roomId` preserved-or-nulled per design and friends' snapshots untouched.

### T2.2 Retention purge — closes **H7 (+L15 residue)**
Files: `src/lib/insights/jobs.ts` (`runAICleanup` extension), `docs/OPERATIONS.md`
Add to the existing cleanup job (idempotent, cursor-less simple deleteManys):
- `roomMessage.deleteMany({ createdAt: { lt: now-30d } })` — matches the documented 30-day retention.
- `taskDraft.deleteMany({ expiresAt: { lt: now } })`.
- `passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { lt: now-7d } }] } })`.
- `accountabilityCheck.deleteMany({ createdAt: { lt: now-90d } })`.
Update OPERATIONS.md to state exactly these rules (doc ↔ code truth).
**Accept:** job runs green twice in a row (second run deletes 0); counts logged via T1.6 logger.

### T2.3 Index bundle — closes **L14 (+purge support)**
Same migration: `Task(userId, completedAt)`; `Notification(userId, createdAt)`; single-column indexes backing every T2.2 predicate (`RoomMessage.createdAt`, `TaskDraft.expiresAt`, `PasswordResetToken.expiresAt`). Drop decision D4 execution here too: remove `DailyUserMetric` model + export reference.
**Accept:** `EXPLAIN` on the goal-progress/analytics query switches from seq-scan to index scan on a seeded dataset.

---

## Phase 3 — Security hardening (~2 days)

### T3.1 Nonce-based CSP — closes **M1**
Files: `src/proxy.ts`, `next.config.ts`, perf-bootstrap `<script>` in `layout.tsx`
1. Proxy generates a per-request nonce (`crypto.randomUUID()` base64), sets `X-Nonce` (or passes via request header mutation) **and** the full `Content-Security-Policy` header itself in production, replacing the static one from next.config: `script-src 'self' 'nonce-<x>' 'strict-dynamic';` keeping all other directives unchanged.
2. Next automatically applies its own nonces to framework scripts when it sees a nonce'd CSP from proxy/middleware; the one hand-written inline script gets `nonce={...}` — read from headers() in layout (server component) or rendered via the InlineScript pattern from the Next docs.
3. Dev keeps `'unsafe-inline' 'unsafe-eval'` (unchanged ergonomics).
4. Test matrix: sign-in, dashboard, exam-plan editor, share page — console must show zero CSP violations; RSC navigation still hydrates.
**Accept:** production response headers show nonce'd script-src; injecting `<script>alert(1)</script>` via any stored field is blocked by the browser.

### T3.2 Rate-limit identity hardening — closes **M3**
File: `src/lib/http/rate-limit.ts`
`requestIdentifier()` order becomes: `x-real-ip` → configured-hop `x-forwarded-for` (new env `TRUSTED_PROXY_COUNT`, default `1`) → fall back to a keyed bucket of last resort. Document Vercel's guarantees in a comment; Upstash stays the store in prod (already implemented).
**Accept:** unit test with spoofed first-hop XFF + trusted count resolves to the real client hop.

### T3.3 Reset-link origin pinning — closes **M4**
File: `forgot-password/route.ts`
Replace `new URL(request.url).origin` with `siteOrigin()` called **without** the request argument (env chain: `APP_URL` → `NEXTAUTH_URL` → Vercel URLs — already implemented in `base-url.ts:40-62`). Add one sentence to `base-url.ts`'s header comment explaining why recovery emails deliberately ignore the live request origin (its own doc currently recommends the opposite for general callers).
**Accept:** request with poisoned Host still emits an email linking to the configured domain.

### T3.4 Atomic timer CAS — closes **M7**
Files: `timer/[timerId]/[action]/route.ts`, `lobbies/[roomId]/timer/[action]/route.ts`
Convert both version gates to `run.updateMany({ where: { id: run.id, version: claimedVersion, endedAt: null … }, data })`; `count === 0` ⇒ `409 conflict("timer_version_conflict")` using the existing conflict helper.
**Accept:** parallel pause+complete race test yields exactly one winner and one 409.

### T3.5 Lobby join hardening — closes **M8 (both halves)**
Files: schema (Room.inviteCode), migration, `join/route.ts`, lobbies create service
1. Capacity: wrap membership upsert in a transaction that re-counts members with `SELECT … FOR UPDATE`-equivalent semantics (Prisma: interactive transaction + count check + create; accept rare 409 under contention).
2. PRIVATE rooms: generate `inviteCode` (22-char random) at creation; `join` requires a matching `code` body param when `visibility === "PRIVATE"`; share-links for private rooms carry the code.
**Accept:** overshoot attempt at cap fails; PRIVATE join without code → 404-style indistinguishable denial.

### T3.6 One-live-challenge-per-pair — closes **M9**
Schema+migration: `Challenge.pairKey String?` (canonical sorted creator/opponent ids), backfill UPDATE in the migration, then partial unique index `WHERE status IN ('PENDING','SCHEDULED','ACTIVE')` (raw SQL, documented per the phase11 convention). Service inserts populate pairKey; duplicate insert surfaces as P2002 → friendly conflict.
**Accept:** concurrent double-create yields one challenge + one conflict.

### T3.7 Atomic AI-job claims — closes **M10**
Files: `src/lib/ai/jobs.ts`, `api/tasks/parse/route.ts`
Replace sniff-then-upsert with claim-by-transition: `aiJob.updateMany({ where: { jobKey, status: { notIn: ["RUNNING","COMPLETED"] } }, data: { status: "RUNNING", startedAt: now } })`; count 0 ⇒ treat as in-flight/duplicate (return cached/409 per existing UX). Register `TASK_PARSE` as a tracked job type so the parse route counts against daily job limits and appears in dashboards.
**Accept:** concurrent identical generation requests produce one Groq call (assert via mocked client counter).

### T3.8 Export/residue completeness — closes **M11**
Files: `me/export/route.ts`, `me/route.ts` DELETE
Add `studyPlans`, `studyPlanSaves`, `sessionReactions`, `hostedTimerRuns`, `ownedRooms` to the export allowlist (same shape conventions). In the delete flow, null out `ServiceUsageLog.metadata` for the departing user's rows (updateMany) so no freeform JSON survives identity deletion.
**Accept:** exported archive contains forum plans; post-delete usage-log rows have empty metadata.

### T3.9 Search privacy — closes **M13**
File: `users/search/route.ts`
Drop `collegeId contains` matching; keep name-contains + exact-match collegeId only when the query length equals full-ID shape AND apply the stricter 60/min limit already present. Update README privacy sentence to match reality ("IDs findable only by exact match").
**Accept:** fragment probing returns nothing; exact-ID lookup still works for friend flows.

### T3.10 Silent-failure surfacing — closes **M14**
Files: `forgot-password/route.ts`, `mailer.ts` callers, `.github/workflows/cron.yml`
1. Mailer results: log `delivered:false` via captureError (response to user stays `ok:true`).
2. Cron workflow: collect each curl's exit code; end job with `exit $FAILED` so a dead pipeline goes red; optionally add a workflow_dispatch manual trigger.
3. CRON_SECRET absence now produces a boot warning via T1.1 validation tier.
**Accept:** stopping SMTP locally produces a visible structured error; breaking one cron URL turns the Actions job red.

### T3.11 Deployment assertions — closes **M15 (config halves)**
Files: `vercel.json`, `package.json`
`vercel.json`: `regions: ["fra1"]` (nearest to EU-hosted Supabase/Alexandria users — confirm at apply time), function memory/duration overrides for the two AI routes (e.g. 1024 MB / max duration). `package.json`: `"engines": { "node": ">=20" }`.

*(M12-doc was resolved in T1.5 step 4.)*

---

## Phase 4 — Low-severity batch (~1–1.5 days)

| Task | Closes | Change |
|---|---|---|
| T4.1 Timing jitter | L3 (with D3) | Add 150–400ms deterministic-ish delay to forgot/manual-reset miss paths; keep friendly responses; document residual risk |
| T4.2 Analytics parity | L4 | `[metric]` route reuses `analytics/validation.ts` query schema |
| T4.3 Rate-limit additions | L5 | 60/min reads on analytics·leaderboards·calendar·insights; messages POST 20/min/user; invite/challenge-create 10/h/user |
| T4.4 Status hygiene | L7 | Lobby membership failures 401→403 (existence still not leaked) |
| T4.5 Role freshness | L6 | Admin page-guards read `role` from DB (already selected in T1.4's apiUser path) instead of JWT claim |
| T4.6 Name sanitation | L8 | Zod name schema rejects `\p{Cc}\n\r`; mailer strips control chars defensively pre-send |
| T4.7 Parse robustness | L9 | Wrap `JSON.parse` in `tasks/ai.ts` → `invalid_ai_response` retryable taxonomy |
| T4.8 Realtime module | L10 (D5) | Delete `realtime/supabase.ts` + anon-key env lines; note in README how to reintroduce safely |
| T4.9 Button rel | L11 | Force `rel="noopener noreferrer"` whenever `target` prop present |
| T4.10 Pooler guidance | L16 | `.env.example`: `?connection_limit=5&pool_timeout=10` on pooled URL with comment |
| T4.11 Email-change interim | L17 (D6) | Require current-password field on email change in `me/PATCH` (full loop deferred as its own feature ticket) |
| T4.12 Docs sweep | L19–L21, L20-key | README: production-deploy section (Vercel project, GH Secrets, env table), fix "Auth.js" naming, annotate `SUPABASE_SERVICE_ROLE_KEY` as unused-do-not-add, `.npmrc` rationale |

Deferred-by-design (recorded, not scheduled): L1/L2 enumeration strictness beyond D3, L6-adjacent deep admin work (no admin API exists), L12 forum-report affordance, L13 enum promotion, L18 pg_trgm search scaling, weekly-leaderboard O(N) optimization. Each has a one-line entry in the audit's Low list — reopen when scale or product direction demands.

---

## Phase 5 — Release gates (~½ day)

1. **Full local gate:** typecheck · lint · vitest · `npm run build` · e2e suite pointed at the production build (`playwright.config.ts` webServer mode switch — one-line config change + CI wiring).
2. **Staging rehearsal:** apply Phase-2 migration batch to a prod copy; run smoke checklist below.
3. **Deploy checklist:** all env vars present (table from `.env.example` after T1.1) · GH Secrets `APP_URL`/`CRON_SECRET` set · Upstash enabled · Sentry-or-log destination confirmed · vercel.json region confirmed against actual DB location.
4. **Post-deploy smoke (15 min):** `/api/health` 200 → sign-in → cookie prefix `__Secure-` → forgot-password email lands with correct domain + old sessions die → dashboard scroll/perf sanity (Atlas lite-mode triggers correctly on throttled CPU) → CSP header present, zero console violations → force one 429 and observe Retry-After.
5. **First-week watch:** structured error logs empty of new signatures; cron Actions job green; cleanup job deleting expected counts.

---

## Traceability matrix (every finding → closing task)

| Finding | Task | | Finding | Task | | Finding | Task |
|---|---|---|---|---|---|---|---|
| C1 | T1.1 | | M2 | T1.7 | | L3 | T4.1 |
| H1 | T1.1 | | M3 | T3.2 | | L4 | T4.2 |
| H2 | T1.5 | | M4 | T3.3 | | L5 | T4.3 |
| H3 | T1.3 | | M5 | T1.6 | | L6 | T4.5 |
| H4 | T1.4 | | M6 | T1.6 | | L7 | T4.4 |
| H5 | T2.1 | | M7 | T3.4 | | L8 | T4.6 |
| H6 | T2.1 | | M8 | T3.5 | | L9 | T4.7 |
| H7 | T2.2 | | M9 | T3.6 | | L10 | T4.8 |
| H8 | T1.2 | | M10 | T3.7 | | L11 | T4.9 |
| M1 | T3.1 | | M11 | T3.8 | | L12 | deferred (noted) |
| M12-doc | T1.5 | | M13 | T3.9 | | L13 | deferred (noted) |
| M14 | T3.10 | | M15-config | T3.11 | | L14 | T2.3 |
| M15-e2e | Phase 5 | | | | | L15 | T2.2 |
| | | | | | | L16 | T4.10 |
| | | | | | | L17 | T4.11 |
| | | | | | | L18 | T2.3 (D4) |
| | | | | | | L19–21 | T4.12 |

**Coverage: 43/43 findings accounted for — 39 scheduled, 4 explicitly deferred with rationale (D3 scope, product features).**

---

## Effort summary

| Phase | Content | Estimate |
|---|---|---|
| 0 | Safety net | 0.5 h |
| 1 | Launch blockers | ~1.5 d |
| 2 | Migration batch | 0.5–1 d |
| 3 | Security hardening | ~2 d |
| 4 | Low batch | 1–1.5 d |
| 5 | Release gates | 0.5 d |
| **Total** | | **≈ 5.5–6.5 d** |

Say "start Phase 0" (or name any phase/task) and I'll begin executing.
