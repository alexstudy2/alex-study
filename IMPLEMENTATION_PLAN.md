# Study Tracker Web App — Implementation Plan

> Status: awaiting explicit approval before implementation. No application code should be written until this plan is approved. Visual design also remains blocked until the project UI/UX guideline is supplied and reviewed.

## 1. Proposed architecture

- Next.js App Router as the full-stack application, with TypeScript in strict mode and Tailwind CSS.
- PostgreSQL with Prisma ORM.
- Auth.js/NextAuth using database sessions, credentials login, and optional Google OAuth.
- Zustand for transient client state such as the active timer UI, filters, drafts, and optimistic realtime state.
- TanStack Query for server-state fetching, caching, mutations, and invalidation.
- Next.js route handlers for standard application APIs.
- Anthropic API through server-only modules; API keys are never exposed to clients.
- Scheduled jobs for recurring tasks, challenge lifecycle, metric rollups, weekly AI reports, and accountability reminders.
- Recommended deployment: Vercel for Next.js and cron jobs, Supabase for PostgreSQL and Realtime.

### Realtime recommendation

Use Supabase Realtime for lobby presence, ephemeral broadcasts, and database-change subscriptions. Serverless Next.js deployments cannot reliably host persistent Socket.io connections. Prisma can remain the primary ORM against the same Supabase PostgreSQL database, while Auth.js remains the authentication system.

If deployment uses a persistent Node host such as Railway, Fly.io, or Render, Socket.io is viable but should use a Redis adapter for multiple application instances.

```text
Next.js UI
├── Route handlers → Prisma → PostgreSQL
├── Realtime client → presence/broadcast channels
└── Server-generated events → persisted records → DB subscriptions

Scheduled worker
├── recurring task generation
├── challenge activation/resolution
├── leaderboard and analytics rollups
├── AI recaps and anomaly checks
└── accountability reminders
```

## 2. Proposed folder/file structure

```text
study-tracker/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── audio/
│   ├── icons/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx
│   │   │   ├── sign-up/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/[token]/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tasks/page.tsx
│   │   │   ├── tasks/[taskId]/page.tsx
│   │   │   ├── focus/page.tsx
│   │   │   ├── sessions/page.tsx
│   │   │   ├── sessions/[sessionId]/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── goals/page.tsx
│   │   │   ├── goals/[goalId]/page.tsx
│   │   │   ├── lobbies/page.tsx
│   │   │   ├── lobbies/create/page.tsx
│   │   │   ├── lobbies/join/page.tsx
│   │   │   ├── lobbies/[roomId]/page.tsx
│   │   │   ├── lobbies/[roomId]/settings/page.tsx
│   │   │   ├── friends/page.tsx
│   │   │   ├── challenges/page.tsx
│   │   │   ├── challenges/new/page.tsx
│   │   │   ├── challenges/[challengeId]/page.tsx
│   │   │   ├── challenges/[challengeId]/result/page.tsx
│   │   │   ├── leaderboard/page.tsx
│   │   │   ├── insights/page.tsx
│   │   │   ├── exam-plans/new/page.tsx
│   │   │   ├── exam-plans/[planId]/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   ├── profile/[username]/page.tsx
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── account/page.tsx
│   │   │       ├── preferences/page.tsx
│   │   │       ├── privacy/page.tsx
│   │   │       ├── notifications/page.tsx
│   │   │       └── integrations/page.tsx
│   │   ├── share/challenges/[shareToken]/page.tsx
│   │   ├── api/...
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── app-shell/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── tasks/
│   │   ├── timer/
│   │   ├── sessions/
│   │   ├── lobbies/
│   │   ├── friends/
│   │   ├── challenges/
│   │   ├── leaderboards/
│   │   ├── analytics/
│   │   ├── insights/
│   │   ├── goals/
│   │   ├── calendar/
│   │   ├── notifications/
│   │   └── ui/
│   ├── features/{auth,tasks,timer,realtime,challenges,analytics,ai}/
│   ├── lib/{auth,db,ai,realtime,analytics,notifications,jobs,validation,dates,permissions,rate-limit}/
│   ├── server/{services,repositories,policies}/
│   ├── stores/
│   ├── hooks/
│   ├── types/
│   ├── styles/{tokens.css,themes.css,motion.css}
│   └── middleware.ts
├── tests/{unit,integration,e2e,accessibility}/
├── design-system/
│   ├── README.md
│   ├── tokens.md
│   ├── component-states.md
│   └── content-voice.md
├── scripts/
│   ├── backfill-analytics.ts
│   └── run-scheduled-jobs.ts
├── next.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── package.json
```

`components/ui` will contain branded primitives, not an unmodified shadcn component collection.

## 3. Database models and relationships

All timestamps use timezone-aware PostgreSQL timestamps stored in UTC. User-facing date grouping uses the user's configured timezone.

### Identity and preferences

#### User

- `id: uuid PK`
- `email: string UNIQUE`
- `username: string UNIQUE`
- `name: string`
- `imageUrl: string?`
- `passwordHash: string?`
- `timezone: string`
- `weekStartsOn: int`
- `aiNudgesEnabled: boolean`
- `leaderboardVisible: boolean`
- `profileVisibility: enum`
- `createdAt`, `updatedAt`

Owns subjects, tasks, sessions, goals, rooms, plans, insights, and notifications. Participates in friendships, rooms, challenges, and accountability pairings.

#### Account, Session, VerificationToken

Standard Auth.js database-adapter models. Accounts and sessions belong to users; verification and password-reset tokens include identifiers, expiry, and consumption state as required.

#### UserPreference

- `id`, `userId UNIQUE FK`
- `theme: system|light|dark`
- `defaultFocusMinutes`, `defaultShortBreakMinutes`, `defaultLongBreakMinutes`
- `pomodorosBeforeLongBreak`
- `autoStartBreaks`, `autoStartFocus`
- `ambientSound`, `ambientVolume`
- `emailNotifications`, `inAppNotifications`
- `accountabilityNotifications`, `challengeNotifications`, `aiInsightNotifications`
- `createdAt`, `updatedAt`

### Study organization

#### Subject

- `id`, `userId FK`, `name`, `colorToken`, `archivedAt?`, timestamps
- Unique `(userId, normalizedName)`

#### Task

- `id`, `userId FK`, `subjectId FK?`, `parentTaskId FK?`
- `title`, `notes?`
- `priority: low|medium|high|urgent`
- `status: todo|in_progress|completed|cancelled`
- `dueAt?`, `estimatedMinutes?`, `sortOrder`, `completedAt?`
- `recurrenceRuleId FK?`, `recurrenceSourceId FK?`
- timestamps, `deletedAt?`

A task may have subtasks, a recurrence rule, generated occurrences, and many study sessions.

#### RecurrenceRule

- `id`, `userId FK`
- `frequency: daily|weekly`, `interval`, `daysOfWeek: int[]`
- `startsOn`, `endsOn?`, `timezone`, `nextOccurrenceAt`, `active`
- timestamps

#### TaskAIParseDraft

- `id`, `userId FK`, `rawInput`, `parsedPayload: jsonb`, `model`
- `status: proposed|accepted|rejected|expired`, `expiresAt`, `createdAt`

This preserves the confirm-before-save requirement.

### Sessions and timers

#### StudySession

- `id`, `userId FK`, `taskId FK?`, `subjectId FK?`
- `roomId FK?`, `roomTimerRunId FK?`
- `startedAt`, `endedAt?`, `durationSeconds`, `plannedDurationSeconds`
- `status: active|completed|abandoned`
- `distractionCount`, `focusScore?`
- `source: solo|room|manual`
- timestamps

#### SessionDistraction

- `id`, `sessionId FK`, `occurredAt`, `note?`

#### TimerRun

- `id`, `userId FK?`, `roomId FK?`, `hostUserId FK?`
- `mode: focus|short_break|long_break`
- `status: scheduled|running|paused|completed|cancelled`
- `durationSeconds`, `startedAt?`, `pausedAt?`, `accumulatedPauseSeconds`
- `sequenceNumber`, `version`, timestamps

The server-authoritative timestamp and version allow clients to derive countdowns without per-second broadcasts.

### Goals and calendar

#### Goal

- `id`, `userId FK`, `subjectId FK?`, `title`
- `metric: study_minutes|tasks_completed`
- `targetValue`, `period: weekly|monthly|custom`
- `startsAt`, `deadline`, `status: active|completed|cancelled`
- `shareVisibility: private|room`, timestamps

Progress is normally derived from source events; cached progress may be maintained for performance.

#### GoalRoomShare

- Composite PK `(goalId, roomId)`
- `sharedByUserId`, `createdAt`

#### ExamPlan

- `id`, `userId FK`, `title`, `examAt`, `syllabusText`
- `status: generating|proposed|accepted|partially_accepted|rejected`
- `model`, timestamps

#### ExamPlanItem

- `id`, `examPlanId FK`, `subjectId FK?`, `title`, `notes?`
- `plannedDate`, `estimatedMinutes`, `sortOrder`, `accepted`
- `createdTaskId FK?`, `createdAt`

Plan items become tasks only after explicit user acceptance.

### Lobbies and social activity

#### Room

- `id`, `ownerId FK`, `name`, `description?`
- `visibility: public|private`, `inviteCodeHash?`
- `chatEnabled`, `maxMembers`, `archivedAt?`, timestamps

#### RoomMember

- `id`, `roomId FK`, `userId FK`, `role: owner|moderator|member`
- `joinedAt`, `lastSeenAt?`
- Unique `(roomId, userId)`

Live status is ephemeral realtime state; `lastSeenAt` supports fallback display.

#### RoomMessage

- `id`, `roomId FK`, `userId FK`, `body`, `createdAt`, `deletedAt?`

#### SessionReaction

- `id`, `sessionId FK`, `roomId FK?`, `senderId FK`, `reaction`, `createdAt`
- Unique `(sessionId, senderId, reaction)`

#### RoomChallenge

- `id`, `roomId FK`, `createdById FK`, `title`
- `metric: study_minutes|tasks_completed`, `targetValue`, `subjectId FK?`
- `startsAt`, `endsAt`, `status: scheduled|active|completed|cancelled`
- timestamps

### Friends and accountability

#### Friendship

- `id`, `requesterId FK`, `addresseeId FK`
- `status: pending|accepted|declined|blocked`
- `createdAt`, `respondedAt?`
- Canonical pair constraints prevent duplicate/reversed friendships.

#### AccountabilityPair

- `id`, `userAId FK`, `userBId FK`, `createdById FK`
- `status: pending|active|paused|ended`
- `lastReminderAt?`, `createdAt`, `endedAt?`

#### AccountabilityCheck

- `id`, `pairId FK`, `subjectUserId FK`, `recipientUserId FK`
- `reason`, `sentAt`, `deliveryStatus`

### 1v1 challenges

#### Challenge

- `id`, `creatorId FK`, `opponentId FK`, `subjectId FK?`
- `type: task_count|study_time|subject_task_count|subject_study_time`
- `targetValue`, `targetUnit: tasks|minutes`
- `startsAt`, `endsAt`
- `status: pending|scheduled|active|completed|declined|cancelled|expired`
- `resolutionType: target_first|deadline_leader|draw?`
- `winnerId FK?`, `resolvedAt?`, `rematchOfId FK?`
- `shareToken UNIQUE`, timestamps

#### ChallengeParticipant

- `id`, `challengeId FK`, `userId FK`, `currentValue`
- `targetReachedAt?`, `lastCalculatedAt`, `finalValue?`
- Unique `(challengeId, userId)`

#### ChallengeProgressEvent

- `id`, `challengeId FK`, `participantId FK`
- `sourceType: task|study_session|adjustment`, `sourceId`
- `deltaValue`, `occurredAt`
- Unique `(challengeId, sourceType, sourceId, participantId)`

#### BadgeDefinition

- `id`, `key UNIQUE`, `name`, `description`, `iconKey`, `criteria: jsonb`

#### UserBadge

- `id`, `userId FK`, `badgeId FK`, `challengeId FK?`, `awardedAt`

### AI and notifications

#### AIInsight

- `id`, `userId FK`
- `type: daily_tip|weekly_recap|performance_drop|burnout|best_time`
- `title`, `content`, `supportingData: jsonb`, `model`
- `validFrom`, `validUntil?`, `dismissedAt?`, `createdAt`

#### AIJob

- `id`, `userId FK?`, `type`, `status: queued|running|completed|failed`
- `inputHash`, `attempts`, `errorCode?`, lifecycle timestamps

#### Notification

- `id`, `userId FK`, `type`, `title`, `body`, `actionUrl?`
- `metadata: jsonb`, `readAt?`, `createdAt`

#### NotificationDelivery

- `id`, `notificationId FK`, `channel: in_app|email|push`
- `status`, `sentAt?`, `failureReason?`

### Analytics and leaderboards

#### DailyUserMetric

- `id`, `userId FK`, `metricDate`, `timezone`
- `studyMinutes`, `plannedMinutes`, `tasksCompleted`, `tasksDue`
- `distractionCount`, `averageFocusScore?`, `currentStreak`
- timestamps; unique `(userId, metricDate)`

#### DailySubjectMetric

- `id`, `userId FK`, `subjectId FK`, `metricDate`
- `studyMinutes`, `tasksCompleted`, `averageFocusScore?`
- Unique `(userId, subjectId, metricDate)`

#### LeaderboardSnapshot

- `id`, `scope: global|friends|room`, `roomId FK?`
- `period: daily|weekly|monthly`, `periodStart`, `periodEnd`
- `metric`, `generatedAt`

#### LeaderboardEntry

- `id`, `snapshotId FK`, `userId FK`, `rank`, `value`, `secondaryValue?`
- Unique `(snapshotId, userId)`

### ERD relationship summary

```text
User 1─* Subject
User 1─* Task
Task 1─* Task (subtasks)
Task *─0..1 RecurrenceRule
User 1─* StudySession
Task 0..1─* StudySession
Subject 0..1─* Task / StudySession / Goal
Room *─* User through RoomMember
Room 1─* TimerRun / RoomMessage / RoomChallenge
User *─* User through Friendship
User *─* User through AccountabilityPair
Challenge 1─2 ChallengeParticipant
ChallengeParticipant 1─* ChallengeProgressEvent
User 1─* AIInsight / Notification / ExamPlan
ExamPlan 1─* ExamPlanItem
User 1─* DailyUserMetric
Subject 1─* DailySubjectMetric
LeaderboardSnapshot 1─* LeaderboardEntry
```

## 4. Page and route map

### Public and authentication

- `/` — public entry or authenticated redirect.
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/reset-password/[token]`
- `/share/challenges/[shareToken]`

### Core application

- `/dashboard`
- `/tasks`
- `/tasks/[taskId]`
- `/focus`
- `/sessions`
- `/sessions/[sessionId]`
- `/analytics`
- `/calendar`
- `/goals`
- `/goals/[goalId]`
- `/insights`
- `/exam-plans/new`
- `/exam-plans/[planId]`

### Social

- `/lobbies`
- `/lobbies/create`
- `/lobbies/join`
- `/lobbies/[roomId]`
- `/lobbies/[roomId]/settings`
- `/friends`
- `/leaderboard`
- `/challenges`
- `/challenges/new`
- `/challenges/[challengeId]`
- `/challenges/[challengeId]/result`
- `/profile/[username]`
- `/notifications`

### Settings

- `/settings`
- `/settings/account`
- `/settings/preferences`
- `/settings/privacy`
- `/settings/notifications`
- `/settings/integrations`

Important states remain directly addressable even if intercepted modal routes are later added.

## 5. Major component breakdown

### Shared application shell

- Responsive sidebar and mobile navigation.
- Contextual header, global quick-add, active timer dock, notification trigger.
- Realtime connection status, theme control, command/search palette.
- Branded accessible dialogs, sheets, menus, forms, feedback, and data displays.

### Dashboard

- Today snapshot, planned-versus-actual meter, streak, weekly progress.
- Due tasks, deadline timeline, active goals, AI tip.
- Start/continue focus action and lobby/friend activity.
- Purpose-written onboarding and empty states.

### Tasks

- Natural-language quick-add and AI confirmation editor.
- Create/edit panel, filters, grouping, sorting, bulk actions.
- Drag-and-drop with keyboard reorder alternative.
- Task rows, subtasks, recurrence editor, and task detail view.

### Focus and sessions

- Timer stage, focus/break controls, task/subject selector.
- Distraction control, ambient sound, minimal Focus Mode.
- Completion reflection, session log/detail, and active-session recovery.

### Analytics

- Range/subject filters and summary metrics.
- Study trend, subject distribution, completion, planned/actual, time-of-day, heatmap, and Focus Score views.
- Accessible text summaries and data-table alternatives.

### Calendar and goals

- Month/week calendar, agenda mode, combined task/session events, event details, filters, quick-add.
- Goal list, create/edit flow, progress, history, subject filters, and lobby sharing.

### Lobbies

- Discovery, create/join flows, room header, presence roster.
- Synced timer with host controls and transfer rules.
- Minimal chat, reactions, room leaderboard, group challenges, settings, moderation, and reconnect feedback.

### Friends and leaderboards

- User search, requests, friend list, accountability controls.
- Global/friends leaderboards, privacy states, supportive rank presentation.

### 1v1 challenges

- Multi-step composer and opponent picker.
- Type, target, subject, and duration controls.
- Invite response, live progress, countdown, event timeline.
- Result, share card, history, statistics, rematch, and badges.

### AI and exam plans

- Insight feed, AI attribution, dismiss/disable actions.
- Weekly recap, performance/burnout notices, best-time recommendation.
- Exam-plan form, editable proposal, selective acceptance, and task conversion confirmation.

### Settings and profile

- Account, timer defaults, appearance, accessibility, AI opt-out, privacy, notifications, OAuth providers, public profile, and badges.

## 6. API endpoint plan

All mutations require authentication, Zod validation, authorization, CSRF-safe session handling, and appropriate rate limits.

### Authentication

- `GET|POST /api/auth/[...nextauth]` — Auth.js handlers.
- `POST /api/auth/register` — credentials registration.
- `POST /api/auth/forgot-password` — send reset token.
- `POST /api/auth/reset-password` — update password using token.

### User and settings

- `GET /api/me`
- `PATCH /api/me`
- `PATCH /api/me/preferences`
- `PATCH /api/me/privacy`
- `PATCH /api/me/notifications`
- `GET /api/users/search?q=`
- `GET /api/users/[username]`

### Subjects

- `GET|POST /api/subjects`
- `PATCH|DELETE /api/subjects/[subjectId]`

### Tasks

- `GET|POST /api/tasks`
- `GET|PATCH|DELETE /api/tasks/[taskId]`
- `POST /api/tasks/[taskId]/complete`
- `POST /api/tasks/[taskId]/reopen`
- `POST /api/tasks/reorder`
- `POST /api/tasks/bulk`
- `POST /api/tasks/parse`
- `POST /api/tasks/parse/[draftId]/accept`
- `POST /api/tasks/parse/[draftId]/reject`

### Sessions and timers

- `GET|POST /api/sessions`
- `GET|PATCH|DELETE /api/sessions/[sessionId]`
- `POST /api/timers`
- `GET /api/timers/active`
- `POST /api/timers/[timerId]/pause`
- `POST /api/timers/[timerId]/resume`
- `POST /api/timers/[timerId]/complete`
- `POST /api/timers/[timerId]/cancel`
- `POST /api/timers/[timerId]/distractions`

### Dashboard, analytics, and calendar

- `GET /api/dashboard?date=`
- `GET /api/analytics/summary`
- `GET /api/analytics/study-hours`
- `GET /api/analytics/subjects`
- `GET /api/analytics/task-completion`
- `GET /api/analytics/planned-vs-actual`
- `GET /api/analytics/productive-times`
- `GET /api/analytics/activity`
- `GET /api/analytics/focus-score`
- `GET /api/calendar?start=&end=`

### Goals

- `GET|POST /api/goals`
- `GET|PATCH|DELETE /api/goals/[goalId]`
- `POST /api/goals/[goalId]/share`
- `DELETE /api/goals/[goalId]/share/[roomId]`

### Friends and accountability

- `GET /api/friends`
- `GET /api/friends/requests`
- `POST /api/friends/requests`
- `POST /api/friends/requests/[friendshipId]/accept`
- `POST /api/friends/requests/[friendshipId]/decline`
- `DELETE /api/friends/[friendshipId]`
- `POST /api/friends/[friendshipId]/block`
- `GET /api/accountability`
- `POST /api/accountability/invites`
- `POST /api/accountability/[pairId]/accept`
- `PATCH|DELETE /api/accountability/[pairId]`

### Lobbies

- `GET|POST /api/rooms`
- `GET|PATCH|DELETE /api/rooms/[roomId]`
- `POST /api/rooms/join`
- `POST /api/rooms/[roomId]/leave`
- `GET /api/rooms/[roomId]/members`
- `PATCH|DELETE /api/rooms/[roomId]/members/[userId]`
- `POST /api/rooms/[roomId]/invite-code/rotate`
- `GET|POST /api/rooms/[roomId]/messages`
- `DELETE /api/rooms/[roomId]/messages/[messageId]`
- `POST /api/rooms/[roomId]/reactions`
- `GET /api/rooms/[roomId]/leaderboard`
- `GET|POST /api/rooms/[roomId]/challenges`
- `PATCH /api/rooms/[roomId]/challenges/[roomChallengeId]`

### Room timer commands

- `GET /api/rooms/[roomId]/timer`
- `POST /api/rooms/[roomId]/timer/start`
- `POST /api/rooms/[roomId]/timer/pause`
- `POST /api/rooms/[roomId]/timer/resume`
- `POST /api/rooms/[roomId]/timer/complete`
- `POST /api/rooms/[roomId]/timer/cancel`

Commands check room roles and use optimistic concurrency through `TimerRun.version`.

### Challenges

- `GET|POST /api/challenges`
- `GET /api/challenges/[challengeId]`
- `POST /api/challenges/[challengeId]/accept`
- `POST /api/challenges/[challengeId]/decline`
- `POST /api/challenges/[challengeId]/cancel`
- `GET /api/challenges/[challengeId]/progress`
- `GET /api/challenges/[challengeId]/events`
- `POST /api/challenges/[challengeId]/rematch`
- `POST /api/challenges/[challengeId]/share-token/rotate`
- `GET /api/challenges/stats`
- `GET /api/challenges/history`
- `GET /api/public/challenges/[shareToken]`

### Leaderboards

- `GET /api/leaderboards/global`
- `GET /api/leaderboards/friends`
- `GET /api/leaderboards/rooms/[roomId]`

### AI and exam plans

- `GET /api/insights`
- `POST /api/insights/[insightId]/dismiss`
- `POST /api/insights/daily-tip`
- `GET /api/insights/weekly-recap`
- `POST /api/exam-plans/generate`
- `GET|PATCH /api/exam-plans/[planId]`
- `POST /api/exam-plans/[planId]/accept`
- `POST /api/exam-plans/[planId]/reject`

### Notifications

- `GET /api/notifications`
- `POST /api/notifications/[notificationId]/read`
- `POST /api/notifications/read-all`

### Scheduled internal routes

Protected with a cron secret or platform scheduler identity:

- `POST /api/internal/jobs/recurring-tasks`
- `POST /api/internal/jobs/challenges`
- `POST /api/internal/jobs/daily-rollups`
- `POST /api/internal/jobs/weekly-leaderboards`
- `POST /api/internal/jobs/ai-recaps`
- `POST /api/internal/jobs/performance-detection`
- `POST /api/internal/jobs/burnout-detection`
- `POST /api/internal/jobs/accountability-reminders`
- `POST /api/internal/jobs/cleanup`

### Realtime channels and events

#### Private user channel: `user:{userId}`

- `notification.created`
- `friend.requested`, `friend.accepted`
- `challenge.invited`, `challenge.updated`, `challenge.resolved`
- `accountability.updated`

#### Room channel: `room:{roomId}`

Presence payload includes user identity, avatar, `studying|break|idle` state, timer mode, and last state-change timestamp.

Events:

- `presence.sync`
- `timer.started`, `timer.paused`, `timer.resumed`, `timer.completed`, `timer.cancelled`
- `message.created`, `reaction.created`, `member.updated`
- `room_challenge.updated`, `leaderboard.invalidated`

#### Challenge channel: `challenge:{challengeId}`

- `progress.updated`
- `participant.target_reached`
- `challenge.started`
- `challenge.resolved`

Persistent mutations still use route handlers. Realtime messages are not the source of truth. Reconnecting clients refetch canonical state before consuming new events.

Polling fallback:

- Lobby timer/presence: every 5–10 seconds.
- Challenge progress: every 10–15 seconds.
- Notifications: every 30–60 seconds.
- Countdowns remain locally derived from server timestamps.

## 7. Third-party services and libraries

### Core

- Next.js, React, TypeScript, Tailwind CSS.
- Prisma and PostgreSQL.
- Auth.js with Prisma adapter.
- `bcryptjs` or `argon2` for password hashes.
- Zod and React Hook Form.
- Zustand and TanStack Query.

### Realtime

- `@supabase/supabase-js` with Supabase-hosted PostgreSQL.
- Alternative: Socket.io plus Redis adapter on persistent Node hosting.
- Alternative managed pub/sub: Pusher or Ably.

### UI and interaction

- `@dnd-kit` for drag ordering plus accessible alternatives.
- One consistent SVG icon family, preferably Phosphor.
- `next-themes` for theme choice.
- Motion/Framer Motion only for purposeful transitions.
- Headless Radix primitives may be used internally, without default shadcn styling.

### Visualization and dates

- Recharts.
- A custom accessible CSS-grid heatmap or a vetted heatmap library.
- `date-fns` plus `date-fns-tz`, or Luxon.
- `rrule` if recurrence grows beyond daily/weekly.

### AI

- Official Anthropic TypeScript SDK.
- Structured JSON outputs validated with Zod.
- Server-side prompt templates, rate limits, caching, and cost logging.

### Jobs, email, and operations

- Vercel Cron or Trigger.dev/Inngest.
- Resend for transactional email.
- Upstash Redis for rate limits, locks, idempotency, and optional caching.
- Sentry for monitoring.
- Optional PostHog only with suitable privacy consent.

### Testing

- Vitest, React Testing Library, Playwright, axe-core, and MSW where useful.

## 8. Design-system approach

The visual system will not be finalized until the supplied UI/UX guideline is reviewed. It will be converted into enforceable documentation and tokens:

- Primitive, semantic, and component color tokens.
- Independently designed light and dark themes.
- Deliberate typography roles and responsive type scale.
- 4/8-point spacing rhythm.
- Radius, border, shadow, elevation, icon, motion, and z-index scales.
- Accessible chart palette and supportive product content voice.

Quality constraints:

- No default Tailwind-blue theme or unmodified shadcn visual language.
- No generic repeated centered-card layouts.
- One clear primary action per view.
- Visible keyboard focus and keyboard alternatives for dragging.
- WCAG 2.2 AA contrast targets and minimum 44×44 mobile touch targets.
- Reduced-motion support and tabular timer figures.
- Charts cannot rely on color alone and must offer text/data alternatives.
- AI content always carries an explicit AI label and opt-out path.

## 9. Phased build order

### Phase 0 — Decisions and design foundation

Delivered:

- UI/UX guideline reviewed.
- Hosting, realtime, auth, notifications, product vocabulary, and tone decisions finalized.
- Design tokens, shell wireframes, acceptance criteria, and test strategy approved.

### Phase 1 — Project and infrastructure foundation

Delivered:

- Next.js/TypeScript/Tailwind setup.
- Strict linting, formatting, environment validation, and test setup.
- Prisma workflow, Auth.js foundation, validation, logging, errors, rate limiting, CI, and branded primitives.

### Phase 2 — Database, auth, onboarding, and seed data

Delivered:

- Core schema and migrations.
- Credentials auth, optional Google login, reset/verification flow.
- Preferences, subjects, privacy defaults, route protection, authorization tests.
- Seed users, friends, lobby members, tasks, sessions, goals, challenges, and analytics.

### Phase 3 — Task management

Delivered:

- Task/subtask CRUD, recurrence, filters, ordering, bulk actions.
- Natural-language quick-add with confirm/edit-before-save.
- Accessible loading, empty, error, drag, and keyboard states.

### Phase 4 — Timer and session tracking

Delivered:

- Configurable Pomodoro, subject/task links, recovery, distractions, Focus Mode, ambient sound, logs, and initial Focus Score.
- Correct lifecycle across refresh, sleep, closed tabs, and timezones.

### Phase 5 — Dashboard, goals, and calendar

Delivered:

- Today snapshot, planned/actual, streak, weekly progress, deadlines, AI-tip contract.
- Weekly/monthly/subject goals and lobby sharing entry points.
- Month/week calendar combining tasks and sessions.

### Phase 6 — Analytics foundation

Delivered:

- Rollups and all specified analytics views.
- Accessible chart alternatives, recalculation/backfill job, timezone-safe boundaries.

### Phase 7 — Realtime foundation and lobbies

Delivered:

- Channel authorization, public/private rooms, presence, synced timer, reconnect behavior.
- Minimal chat, reactions, room leaderboard, group challenges, moderation, and host transfer.
- Concurrency and reconnect tests.

### Phase 8 — Friends, notifications, and accountability

Delivered:

- Friend search/requests and all relationship states.
- In-app and selected email notifications.
- Opt-in accountability pairing, frequency-capped 24-hour reminders, and privacy controls.

### Phase 9 — 1v1 challenges and leaderboards

Delivered:

- Challenge creation, invites, live progress, lifecycle, idempotent events, resolution rules.
- Results, share cards, badges, statistics, history, rematch.
- Weekly global/friends leaderboards and privacy exclusion.

### Phase 10 — AI insights and exam planner

Delivered:

- Recaps, performance-drop and burnout detection, best-time suggestions.
- AI-written supportive explanations and editable exam-plan proposals.
- Retries, cost controls, attribution, audit metadata, and opt-out.

Deterministic statistics detect patterns; Anthropic explains them. AI never decides challenge winners or commits tasks without confirmation.

### Phase 11 — Hardening and launch polish

Delivered:

- Responsive, dark-mode, accessibility, reduced-motion, keyboard, security, rate-limit, realtime, and performance audits.
- Operational documentation, backup/restore notes, demo refinement, and critical end-to-end tests.

At the end of every phase, provide a summary of work, verification, limitations, and the next phase before proceeding.

## 10. Open decisions requiring user input

### Required before implementation

1. Supply the UI/UX guideline before visual work.
2. Confirm deployment target. Recommendation: Vercel + Supabase.
3. Confirm realtime choice. Recommendation: Supabase Realtime.
4. Confirm auth scope: credentials, Google, email verification, and password reset.
5. Confirm Anthropic credentials, preferred Claude model, and cost ceiling.
6. Confirm whether Resend is acceptable for transactional email.

### Product rules

7. Challenge behavior: first to target, highest at deadline, or selectable mode.
8. Rules preventing trivial-task challenge gaming.
9. Whether edits/deletions recalculate competitive progress. Recommendation: yes, with adjustment events.
10. Weekly reset and canonical global timezone. Recommendation: Monday; UTC for global rankings.
11. Meaning of “global” leaderboard.
12. Room capacity and chat retention. Proposed: 25 members and 30 days.
13. Accountability delivery: in-app only or in-app plus email.
14. Exact transparent Focus Score formula.
15. Whether manual sessions count competitively. Recommendation: personal analytics only.
16. Identity/privacy defaults for public challenge cards.
17. Account deletion, export, AI context retention, chat retention, and analytics-consent policy.
18. Whether all features are required for first public release or an earlier MVP milestone is desired.

## 11. Risks and complexity flags

- **Serverless realtime:** Socket.io is unsuitable as the default on Vercel; Supabase avoids persistent-server requirements but adds channel authorization and policy work.
- **Synced timers:** Clients must derive countdowns from authoritative server timestamps rather than receiving per-second broadcasts.
- **Host disconnection:** Rules are needed for timer continuation and control transfer. Recommendation: continue the timer and retain role-based controls.
- **Challenge correctness:** Duplicate/late events, mutations, ties, and timezones require transactional, idempotent progress and resolution.
- **Scheduled resolution:** Challenges must resolve through a reliable scheduler, not when a user next opens a page.
- **Competitive abuse:** Manual sessions, trivial tasks, retroactive edits, and duplicate accounts require explicit eligibility rules.
- **Privacy leakage:** Presence, email search, leaderboards, room membership, last-active data, and share cards require strict filtering and authorization.
- **Recurring tasks:** Timezone-aware generation, duplicate prevention, and occurrence-versus-series editing are non-trivial.
- **Timer persistence:** Browser throttling, device sleep, refreshes, and clock drift require server timestamps as the source of truth.
- **Analytics boundaries:** Today, streaks, late-night behavior, and weekly resets must be calculated in the correct timezone.
- **AI reliability:** Ambiguous natural-language dates and generated plans require schema validation and user confirmation.
- **AI privacy/cost:** Context minimization, aggregation, caching, rate limits, opt-out, and retention rules are required.
- **Burnout detection:** This must remain conservative wellness guidance, never diagnosis or shame.
- **Accessibility:** Drag-and-drop and charts need keyboard/non-pointer alternatives and textual equivalents.
- **Audio:** Browser autoplay restrictions require explicit user interaction and accessible controls.
- **Notifications:** Browser push adds substantial service-worker, permission, subscription, and provider complexity.
- **Scope:** The full production-grade feature set is large; phases and feature flags should prevent unfinished social functionality destabilizing the core.
- **Distinctive design:** Visual quality requires an early design-system phase and continuous visual QA, not a final styling pass.

## Approval gate

Implementation starts only after:

1. The user explicitly approves this plan.
2. The UI/UX guideline is supplied and reviewed before visual design.
3. Required architecture and product decisions above are resolved sufficiently for the relevant phase.
