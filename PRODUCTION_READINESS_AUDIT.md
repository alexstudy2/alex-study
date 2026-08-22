# Production Readiness & Vulnerability Audit — Alex Study

**Date:** 2026-08-22 · **Scope:** entire repository (`src/**`, `prisma/**`, config, CI, dependencies)
**Method:** 4 parallel deep-audit passes (API authorization across all 91 route files · injection/XSS/client-safety · config/deps/CI/headers · database/data-integrity) + direct verification of every Critical/High finding against source.
**This scan changed nothing.** The only file created is this report. No source, config, or dependency file was touched. A production build was intentionally not run because a live dev server currently owns `.next`.

---

## Executive summary

| Severity | Count | One-line gist |
|---|---|---|
| 🔴 Critical | **1** | Production can boot with a publicly-known JWT signing secret |
| 🟠 High | **8** | Migration drift on the auth key, cross-user cascade data loss ×2, reset-token lifecycle gaps, missing observability, dependency desync |
| 🟡 Medium | **15** | CSP inline scripts, one IDOR-class gap, spoofable rate-limit keys, races under concurrency, silent-failure paths |
| 🟢 Low | **19** | Enumeration vectors, latent library-level risks, hygiene items |

**Verdict: NOT production-ready until P0 items below are fixed.** The application layer is unusually disciplined for its size — ownership scoping, validation, and injection defenses are near-uniformly correct — but the deployment story (env fail-open, schema drift, zero monitoring) would turn a bad day into a silent catastrophe.

---

## Severity definitions

- **Critical** — exploitable or failure-prone in a default production deployment; fix before any public traffic.
- **High** — realistic data loss / takeover path or launch-blocking operational gap.
- **Medium** — exploitable under specific conditions, or degrades reliability/security-in-depth.
- **Low** — hardening, hygiene, documentation, or theoretical impact today.

---

## 🔴 Critical findings

### C1 · Production boots with publicly-known secrets if env vars are missing
**Where:** `src/lib/config/env.ts:17-24` *(verified directly during this scan)*
```ts
export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost:5432/alex_study",
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "development-only-change-this-secret-123456",
```
There is **no `NODE_ENV === "production"` guard anywhere in the file**. The `??` fallback feeds the zod schema (`min(32)`) a valid value, so startup *never* fails on a missing secret. Sessions are JWT-based (`src/lib/auth/options.ts:8`) and the `session` callback copies token claims verbatim — meaning anyone who has read this public repo can forge a valid session JWT offline for **any college ID** if production ever launches without `NEXTAUTH_URL`/`NEXTAUTH_SECRET` set. Same class: `DATABASE_URL` silently points at localhost.
**Fix:** throw when `NODE_ENV === "production"` and either var is absent; keep dev-only fallbacks behind an explicit environment check. (~5 lines.)

---

## 🟠 High findings

### H1 · Env validation isn't wired at boot anyway
`env.ts` is imported only by `src/lib/ai/groq.ts:2` and `src/lib/realtime/supabase.ts:2`. Prisma reads `process.env.DATABASE_URL` directly (`src/lib/db/prisma.ts:5`); next-auth resolves its own secret. So even the zod schema above executes for almost no routes. SMTP_*, UPSTASH_*, CRON_SECRET, NEXTAUTH_URL are validated nowhere and fail silently downstream. **Fix:** import `env.ts` from an instrumentation hook/root entry so it parses once per server start; add strict checks for the remaining prod-required vars.

### H2 · Schema ↔ migration drift on the auth key (launch blocker)
`prisma/migrations/202608140001_phase2_foundation/migration.sql` creates `User_collegeId_key UNIQUE(collegeId)`; no later migration drops it. The schema declares instead `@@unique([collegeId, academicYear])` (`schema.prisma:289`). Consequences: a DB built with `migrate deploy` (the documented runbook) forbids the same collegeId across years — re-enrollment fails with opaque P2002 — while a DB built with `db push` gets different constraints entirely. Additionally `prisma/migrations/migration_lock.toml` does not exist, and README ("Quick Start": `db push`) contradicts `docs/OPERATIONS.md` (`migrate deploy`). **Fix:** reconciliation migration dropping the global key and creating the compound one; commit the lock file; pick one workflow and document it.

### H3 · Reset-token lifecycle: double-use race + surviving siblings
`reset-password/route.ts:14-25` checks `usedAt`/expiry outside the write transaction (read-check-then-write): two concurrent requests can redeem one token twice. `forgot-password/route.ts:18-25` inserts a new token per request without invalidating prior ones — anyone holding multiple live tokens retains redemption after the user rotates their password. Token crypto itself is strong (256-bit random, SHA-256 at rest, 1-hour expiry). **Fix:** CAS consumption (`updateMany({ where: { id, usedAt: null, expiresAt: { gt: now } }, ... })`, abort on count=0) + delete all of the user's tokens inside the reset transaction.

### H4 · No server-side session revocation exists
JWT sessions have no `maxAge` override (next-auth v4 default **30 days**) and no version claim is checked per request (`apiUser()` returns token claims verbatim). A stolen cookie survives a password reset for up to 30 days; deleted users' JWTs stay cryptographically valid until expiry (harmless only because rows cascade away). **Fix:** add a per-user `sessionVersion`/token-version claim bumped on password change and verified in the session callback; consider explicit `maxAge`.

### H5 · Deleting your account destroys your friends' shared leaderboard history
`LeaderboardSnapshot.owner onDelete: Cascade` (`schema.prisma:777`) cascades to entries; FRIENDS snapshots are persisted per generating user (`ownerUserId`) weekly for every user (`lib/leaderboards/service.ts:113,153-165`). Self-service delete (`api/me/route.ts:87`) therefore wipes rank history belonging to *other* users. **Fix:** `ownerUserId` → SetNull (column already nullable) or reassign to a system owner.

### H6 · Room deletion destroys other members' timer runs
`TimerRun.room onDelete: Cascade` (`schema.prisma:488`) versus `StudySession.room SetNull`. Because `Room.owner` cascades, deleting the owner's account deletes the Room → members' active timers killed mid-session and room-timer history destroyed while their StudySessions survive. Inconsistent treatment of equivalent history. **Fix:** `TimerRun.room` → SetNull.

### H7 · Documented data-retention controls don't exist in code
`docs/OPERATIONS.md` claims "Lobby chat retention remains 30 days" — zero code deletes `RoomMessage` anywhere; `RoomMessage.deletedAt` and `TaskDraft.expiresAt` are written nowhere (dead columns); expired `PasswordResetToken`s are never purged; `AccountabilityCheck` rows accrue per reminder. Privacy/compliance gap plus a restore drill that verifies controls that never run. **Fix:** extend the existing cleanup job (`lib/insights/jobs.ts:199-211`) with chat/draft/token purges matching the doc, or fix the doc.

### H8 · Nodemailer major desync between manifest and lockfile
`package.json:36` declares `"nodemailer": "^6.9.16"` but the lockfile pins **9.0.5** (`npm ls`: `invalid: "^6.9.16"`); `@types/nodemailer@^8` matches neither major. Fresh `npm ci` (Vercel build) installs 6.x while local dev runs 9.x — different majors across environments, plus supply-chain determinism risk. Security conclusions that depend on v9 behavior (CRLF header stripping) are version-dependent. **Fix:** align range to installed reality (`^9.0.5`), fix @types, reinstall, commit lockfile.

---

## 🟡 Medium findings

| # | Finding | Evidence | Impact / Fix |
|---|---|---|---|
| M1 | CSP allows inline scripts in **production** | `next.config.ts:8` (`script-src 'self' 'unsafe-inline'`) | Any future XSS sink executes freely; CSP currently blocks nothing an injected script needs. Move to nonce/hash-based policy (Next supports nonce via proxy + `'strict-dynamic'`); the single inline perf bootstrap can be hashed. |
| M2 | Draft-accept writes cross-user IDs without ownership check — the one IDOR-class gap | `api/tasks/parse/[draftId]/accept/route.ts:29-43` spreads `acceptDraftSchema` (`subjectId`/`parentTaskId`) into `task.create`; unlike POST/PATCH `/api/tasks` there is no subject/parent ownership probe; `taskInclude` then leaks the foreign Subject row wholesale | Cross-user course-name leak + referential corruption; requires knowing a victim UUID (hence Medium). Add the same `findFirst({userId})` checks siblings use. |
| M3 | Rate limiting keyed on client-spoofable `x-forwarded-for` first hop; in-memory fallback is per-instance | `rate-limit.ts:27-37`, fallback `:39-55` | Sign-in brute-force (12/15min/IP) and recovery caps (5/h/IP) defeatable where the edge doesn't sanitize XFF; on Vercel without Upstash each instance gets its own budget map. Trust platform IP (`x-real-ip`) / configure trusted hops; keep Upstash wired in prod. |
| M4 | Reset link built from request-derived origin (Host-header poisoning, deployment-dependent) | `forgot-password/route.ts:26-27` uses `new URL(request.url).origin` | Behind a non-pinning proxy, attacker-supplied Host makes emailed links point off-site (token exfil → ATO within 1h window). Build links from the existing `siteOrigin()` env chain (`lib/http/base-url.ts`) as notification mail already does. |
| M5 | Zero error reporting / logging | 0 `console.*` in src/, no Sentry-equivalent, `global-error.tsx:13-17` discards the error object | Server failures vanish without trace. Wire Sentry (or equivalent) into global-error + a route-handler wrapper. |
| M6 | No health endpoint | nothing matches `health` under `src/app/api`; runbook says to monitor | Add `/api/health` returning DB ping. |
| M7 | Timer updates are check-then-act, not atomic CAS | `timer/[timerId]/[action]/route.ts:20-38,93-103`, lobby twin | Concurrent pause/complete both pass stale-version gate → lost update / double finalize. Use `updateMany({ where: { id, version } })` and treat count=0 as 409. |
| M8 | Lobby join capacity race; PRIVATE rooms enforced nowhere | `permissions.ts:7-9` count-then-upsert; `join/route.ts:8-20` ignores `visibility` | Concurrent joins overshoot cap; private rooms protected only by UUID secrecy. Re-count inside a transaction; gate PRIVATE joins (invite codes/approval). |
| M9 | One-live-challenge-per-pair is check-then-act | `challenges/service.ts:37-58` | Concurrent creates yield two simultaneous ACTIVE challenges per pair. Canonical pairKey + partial unique index on live statuses. |
| M10 | AI job dedupe/budget racy; `/api/tasks/parse` bypasses governance | `ai/jobs.ts:99-127` sniff-then-upsert; budgets read-then-act; parse route logs usage but tracks no job type | Concurrent identical requests double-spend tokens/duplicate plans; parse volume invisible to dashboards. Atomic status claim via conditional `updateMany`; track TASK_PARSE as a job type. |
| M11 | Export/delete completeness gaps | export allowlist omits studyPlans/saves/reactions/hostedTimerRuns/ownedRooms; `ServiceUsageLog` SetNull leaves metadata JSON keyed to deleted identity | Data-portability misses forum-authored content; residual rows contradict retention docs. Extend export; anonymize-or-delete usage logs. |
| M12 | Partial unique indexes exist only in raw SQL | `TimerRun_one_open_per_user/_per_room` in phase11_hardening SQL; invisible to Prisma schema/diff | A future `db push` could silently drop the only hard active-timer guard. Document prominently; never push against dependent environments without diffing. |
| M13 | College-ID enumeration via user search contradicts documented privacy stance | `users/search/route.ts:18-21` contains-insensitive on collegeId vs README "never exposed publicly" | Restrict search to names or exact-match IDs behind stricter limits. |
| M14 | Silent degradation paths nobody detects | `mailer.ts:7` returns `{delivered:false}` which forgot-password ignores (recovery silently down, returns ok:true); cron endpoints 403 forever if CRON_SECRET unset; GitHub Actions cron steps end in `\|\| echo "warning"` so a dead pipeline stays green | Fail loudly: surface delivery failures, make the CI cron job exit non-zero, alert on auth-job failures. |
| M15 | Deployment config unasserted | `vercel.json` is `{}` (no regions/function memory-duration for multi-second AI routes); no `engines` field despite Node ≥20 claim; e2e suite = 3 tests against `next dev`, never a production build | Set region near users/DB, function sizing, `engines.node`, and a prod-build e2e mode in CI. |

---

## 🟢 Low findings

1. Pre-auth enumeration via registration conflict (`register/route.ts:36-37` distinct 409) — rate-limited 5/h; consider uniform response/CAPTCHA.
2. Authenticated email enumeration via profile PATCH (`me/route.ts:65-68` `email_in_use`).
3. Account-existence timing side-channels on forgot-password/manual-reset/sign-in (uniform text, uneven latency).
4. `/api/analytics/[metric]` skips the query-param zod validation its `/summary` sibling has (giant windows; own-data only).
5. Missing rate limits: analytics/*, leaderboards (whole-college scans), calendar, insights, copy-to-tasks loop, notifications/read-all, **lobby messages POST (chat spam)**, invite-triggering endpoints (email-bomb channel between friends).
6. Stale JWT role claim frozen up to 30 days post-demotion (theoretical — page guards only, no admin API).
7. Lobby membership failures return 401 rather than 403/404 (conflates signed-out vs non-member).
8. User-controlled `name` reaches email headers/bodies without control-char rejection — safe today because nodemailer 9 strips CRLF from header values and emails are plain-text; harden anyway given H8 pin ambiguity.
9. Unhandled `JSON.parse` in `tasks/ai.ts:34` → raw SyntaxError 500 instead of the retryable `invalid_ai_response` taxonomy used elsewhere.
10. Dead Supabase realtime client constructed but imported nowhere; `NEXT_PUBLIC_SUPABASE_ANON_KEY` ships in every bundle — fine until someone subscribes; audit RLS first. Consider deleting the module.
11. `Button` forwards `target` without forcing `rel="noopener"` (latent reverse tabnabbing; the app's one real `_blank` link already carries noreferrer).
12. Plan Forum lets peers publish arbitrary persuasive prose into others' UIs (escaped React text — no execution; social-engineering surface only).
13. Loose typing: `Goal.metric/status/period` and `User.role` are plain Strings; five JSON columns untyped at rest (zod guards writers today).
14. Index gap: hottest uncovered predicate is `Task(userId, completedAt)` (goal progress, analytics window, AI signals, challenge scans); optional `Notification(userId, createdAt)`; purge-predicate indexes needed alongside H7 fixes.
15. Expired-token/checkin residue accrual (fold into H7 cleanup).
16. Pooler config lacks explicit `connection_limit`/`pool_timeout` for serverless instances.
17. Email changes are unverified (PATCH writes directly; recovery mails follow the new address).
18. `DailyUserMetric` table written nowhere (exported only) — unfinished feature or remove.
19. `.npmrc legacy-peer-deps` papers over peer conflicts (next-auth wants nodemailer ^7); README calls next-auth v4 "Auth.js"; README lacks any production-deployment section (Vercel project, GH Secrets `APP_URL`/`CRON_SECRET` that `cron.yml:21-22` requires).
20. Info: HSTS lacks preload directive (fine unless preload-list submission is desired).

---

## ✅ Verified clean (attacked, found nothing)

- **XSS sinks:** exactly one `dangerouslySetInnerHTML` (constant-string perf bootstrap, zero interpolation); zero innerHTML/eval/document.write/new Function; no markdown sanitizer needed — all user/AI text renders as escaped React children.
- **Injection:** zero `$queryRaw*/$executeRaw*` anywhere — Prisma builder parameterizes by construction; regex inventory linear/anchored (no ReDoS).
- **Open redirects:** next-auth redirect callback same-origin-enforced; `?callbackUrl` sanitized (`/^\/` and rejects `//`, `/\`); all three `window.location.assign` sites are hardcoded paths.
- **SSRF:** the only server fetches target fixed-baseURL Groq and env-configured Upstash.
- **Web storage:** only enum prefs (mood/skin/perf) — no tokens/PII; all guarded try/catch.
- **Secrets hygiene:** `.env` untracked (verified via `git ls-files`); pickaxe over full git history found no committed secret; `.env.example` placeholders only.
- **Cookies/session transport:** `useSecureCookies` pinned to NODE_ENV (Secure + `__Secure-` prefix independent of NEXTAUTH_URL), SameSite=Lax + proxy origin-checking on unsafe methods = sound CSRF posture.
- **Headers beyond CSP:** XFO DENY, frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy lockdown, COOP, prod-gated HSTS+upgrade-insecure-requests.
- **Cron authorization:** length-checked `timingSafeEqual` Bearer compare, fail-closed when secret absent.
- **Credentials provider:** bcrypt cost 12 uniformly; zod bounds prevent bcrypt-length DoS; uppercase-normalized lookup consistent register↔login; generic null on failure.
- **AI cost governance:** 8/h/user route limiter, 14 jobs/day, 40k user / 250k global daily token budgets enforced pre-call, 15-min input-hash reuse cache scoped by userId (no cross-user cache leak), 30-day context purge fields wired into cleanup.
- **Vision endpoint:** anchored data-URL regex + ≤4MB decoded-byte cap without allocation; bytes go body→Groq only (never disk/DB/logs); graceful degradation chain.
- **Public share surface:** only accepted+finished+explicitly-enabled challenges, first-name-only display names, 192-bit rotatable tokens, no task/goal content.
- **Ownership discipline:** near-universal `updateMany/deleteMany` with userId in WHERE or `findFirst({userId})` pre-check across tasks/subjects/sessions/goals/exam-plans/notifications; plan-forum centralizes visibility in permissions.ts; exam-plan acceptance uses Serializable isolation + conditional reservation.
- **npm audit:** 3 highs, all one dev-only chain (`deepmerge-ts <8` ← `@prisma/config` ← prisma CLI); runtime `@prisma/client` unaffected; do **not** run `npm audit fix --force` (downgrades Prisma to 6.12) — wait for patched 6.19.x+/plan Prisma 7.

---

## Already good (worth keeping as patterns)

Clean git history with documented rotation runbook · fail-closed cron auth · deliberate dual-pooler Supabase setup with reasoning comments · DB-enforced active-timer invariant (partial unique indexes surfaced as friendly P2002) · event-sourced self-healing challenge engine · idempotent leaderboard snapshots · textbook Serializable exam-plan acceptance · backup/PITR + restore-drill documentation · strong unit suite (122 vitest cases over engines/validation) · axe accessibility smoke in e2e · robots disallow-all appropriate for a private platform · complete PWA manifest.

---

## Route inventory (91 files audited)

Auth legend: ✅ session · 🌐 intentional-public · 🔑 CRON_SECRET. Ownership: U=user-scoped, P=participant, M=room-member, A=author, F=friendship, T=share-token.

| Path | Methods | Auth | Ownership | Zod | Rate limit | Flags |
|---|---|---|---|---|---|---|
| /api/accountability | GET | ✅ | U | – | – | |
| /api/accountability/invites | POST | ✅ | F | ✅ | – | L5 email channel |
| /api/accountability/[pairId] | PATCH·DELETE | ✅ | P | ✅ | – | |
| …/[pairId]/accept | POST | ✅ | P+PENDING | – | – | |
| /api/analytics/[metric] | GET | ✅ | U | ⚠️ ad-hoc | – | L4 |
| /api/analytics/summary | GET | ✅ | U | ✅ | – | |
| /api/calendar | GET | ✅ | U/A(plan) | ✅ | – | |
| /api/challenges (+history·stats) | GET·POST | ✅ | U/F | ✅ | – | |
| /api/challenges/[id] (+accept·decline·cancel·rematch·events·progress·share-token/rotate) | GET·POST | ✅ | P/service | partial | – | rotate ✅192-bit |
| /api/exam-plans/generate | POST | ✅ | U | ✅ | 8/h/user | +budgets |
| /api/exam-plans/extract-topics | POST | ✅ | U | ✅(image) | 8/h/user | consent-gated |
| /api/exam-plans/[planId] (+accept·reject·publish) | GET·POST·PATCH | ✅ | U | ✅ | – | serializable accept |
| /api/friends (+requests·[id]·block) | GET·POST·DELETE | ✅ | U/F | ✅ | – | |
| /api/goals (+[goalId]) | CRUD | ✅ | U | ✅ | – | |
| /api/insights (+weekly-recap·daily-tip·dismiss) | GET·POST | ✅ | U | – | 8/h·2/day tip | |
| /api/internal/jobs/* (7 jobs) | GET·POST | 🔑 | – | – | – | timing-safe bearer |
| /api/leaderboards/global·friends | GET | ✅ | opt-in/friends | ✅ | – | L5 |
| /api/lobbies (+join·me·messages·timer·reactions) | CRUD·POST | ✅ | M/role | ✅ | – | M8·L5·L7 |
| /api/me (+ai·consent·export·notifications·preferences·privacy) | GET·PATCH·DELETE | ✅ | U | ✅ | export 3/h·delete 5/h | M11·L2 |
| /api/me DELETE | DELETE | ✅ | U+bcrypt | ✅ | 5/h/user | triggers H5/H6 |
| /api/notifications (+read-all·[id]/read) | GET·POST | ✅ | U updateMany | – | – | |
| /api/plan-forum (+items·save·copy-to-tasks) | CRUD·POST | ✅ | A/canViewPlan | ✅ | – | copy loop L5 |
| /api/public/challenges/[shareToken] | GET | 🌐 | T | – | – | tight surface |
| /api/sessions (+[sessionId]) | CRUD | ✅ | U | ✅ | – | hard-delete txn'd |
| /api/subjects (+[subjectId]) | GET·POST·PATCH·DELETE | ✅ | U | ✅ | – | archive-only delete |
| /api/tasks (+bulk·reorder·parse·[taskId]·complete·reopen) | CRUD·POST | ✅ | U | ✅ | parse 8/h | M2·M10 |
| /api/timer (+[timerId]/[action]·distractions) | GET·POST | ✅ | U+CAS | ✅ | – | M7 |
| /api/users/search | GET | ✅ | COLLEGE_ONLY | ✅ | 60/min | M13 |
| /api/auth/[...nextauth] | * | 🌐 | provider | ✅ | 12/15m IP | M3 |
| /api/auth/register | POST | 🌐 | – | ✅ | 5/h/IP | L1 |
| /api/auth/forgot-password | POST | 🌐 | – | ✅ | 5/h/IP | M4·M14·L3 |
| /api/auth/reset-password | POST | 🌐 | tokenHash | ✅ | 5/h/IP | H3·H4 |
| /api/auth/manual-reset | POST | 🌐 | – | ✅ | 5/h/IP | queue model |

Unauthenticated surface = exactly the five auth routes + seven cron jobs — all intentional and gated.

---

## Prioritized remediation roadmap

**P0 — before any real users (~1 day total)**
1. C1+H1: production guard on env fallbacks + wire `env.ts` at boot; validate remaining required vars.
2. H8: align nodemailer/@types, reinstall, lockfile.
3. H3+H4: CAS-consume reset tokens, invalidate siblings, add session-version claim (bump on password change), explicit JWT maxAge.
4. H2: reconcile `User_collegeId_key` via new migration, commit `migration_lock.toml`, single documented migrate workflow.
5. M5+M6: minimal observability — Sentry-free option acceptable initially but something must capture errors; add `/api/health`.
6. M2: ownership checks in draft-accept (one-line pattern copied from siblings).

**P1 — first week**
H5/H6 cascade migrations · H7 purge job + doc truth · M1 nonce-CSP · M3 trusted-proxy IP config · M4 link-origin from APP_URL · M7–M10 atomicity batch (CAS updates, pairKey constraint, atomic AI job claims) · M13/M14 detection for silent failures (mail result, cron CI exit codes) · M12 search restriction.

**P2 — hardening**
M11 export extension · M15 vercel.json regions/functions + engines + prod-build e2e · low-severity batch: rate limits on expensive reads/chat, uniform enumeration responses, analytics validation parity, name control-char rejection, Button rel enforcement, JSON.parse wrap, RLS review-or-remove realtime module, index additions from the table above, pooler limits, verified email changes, docs/deploy section.

**Do not do:** `npm audit fix --force` (breaks Prisma); `prisma db push` against any environment relying on the raw-SQL partial indexes.

---

## Verification performed during this scan

- Direct reads: `src/lib/config/env.ts` (C1 confirmed), `next.config.ts`, `package.json`, layout/proxy/rate-limit sources.
- Commands (read-only): `git ls-files` (`.env` untracked ✓), `npm audit` (3 high, dev-chain ✓), `npm ls nodemailer` desync confirmed by agent.
- Agent passes: all 91 API route files; every `dangerouslySetInnerHTML`/eval/innerHTML grep hit reviewed in context; full `schema.prisma` + all 16 migrations; all `process.env.*` references; regex inventory; storage inventory.
- From the prior session (unchanged since): `npm run typecheck` ✓ · `npm run lint` ✓ (3 pre-existing warnings) · `vitest run` 122/122 ✓ · production build **not** executed this scan to avoid clobbering the running dev server's `.next` — recommended as the final pre-deploy step once P0 lands.
