# Alex Study operations runbook

## Release checklist

1. Confirm the target environment and database project; never seed production.
2. Take a provider snapshot or `pg_dump` before schema migrations.
3. Run `npx prisma migrate deploy` using the direct/admin database connection.
4. Run the repository verification matrix from `README.md`.
5. Confirm `/sign-in`, password recovery, authenticated dashboard, focus timer persistence, notifications, settings export, and scheduler authorization in the deployed environment.
6. Verify security headers with the deployed HTTPS URL and confirm cross-origin mutation requests return 403.
7. Confirm cron invocations and alerting, SMTP delivery, Groq availability/cost ceilings, and Supabase connectivity.

## PostgreSQL backup

Use the database provider's point-in-time recovery or snapshots as the primary mechanism. For a portable logical backup:

```text
pg_dump --format=custom --no-owner --no-acl --file alex-study-YYYYMMDD.dump "$DIRECT_URL"
```

Store backups encrypted, access controlled, and outside the application deployment. Define retention with the institution; do not keep exports indefinitely. User-requested JSON exports are delivered directly to the authenticated user and are not stored by the app.

## Restore drill

1. Create an isolated empty PostgreSQL database; never test restore against production.
2. Restore with `pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" alex-study-YYYYMMDD.dump`.
3. Point a temporary deployment at the restored database.
4. Run `npx prisma migrate status`, `npm run db:validate`, and read-only smoke tests.
5. Verify user/task/session counts, a representative timer, friendships/accountability, notifications, challenge events/results, leaderboards, insights, and exam plans.
6. Verify sensitive invariants: password hashes exist but plaintext passwords do not; college IDs are not exposed publicly; expired AI context and 30-day retained data remain purged as expected.
7. Destroy the temporary restore database and record drill date, recovery time, and issues.

## Incident handling

- Revoke and rotate exposed `NEXTAUTH_SECRET`, database, SMTP, Groq, Supabase service-role, Upstash, and cron credentials immediately.
- Pause cron jobs if a detector, notifier, or lifecycle worker is producing unsafe load or repeated errors.
- Disable Groq independently by removing `GROQ_API_KEY`; core study features remain available.
- If SMTP fails, in-app notification persistence remains authoritative. Password recovery email is unavailable until SMTP is restored; manual reset requests remain available.
- If Upstash fails, the process-local limiter provides best-effort protection per instance. Restore Upstash before high-traffic launch because local fallback is not globally coordinated.
- If Realtime fails, canonical database writes and existing polling fallbacks preserve correctness.

## Monitoring and privacy

- Monitor HTTP 5xx/429 rates, database saturation, scheduled-job duration and cycle completion, SMTP failures, Groq usage/cost limits, and migration status.
- Do not log passwords, reset tokens, authorization headers, full request bodies, college IDs, syllabus text, or JSON export contents.
- AI uses only the authenticated user's aggregate personal data. It never resolves challenges or commits generated tasks without confirmation.
- Retention, enforced by the cleanup cron (`/api/internal/jobs/cleanup`, `runAICleanup`): AI insights past `purgeAt` and exam-plan syllabus text past `contextPurgeAt` purge at 30 days; lobby chat messages at 30 days; expired task drafts on expiry; password-reset tokens on expiry or 7 days after use; accountability check-in rows after 90 days. The cleanup cron is required to enforce unattended deletion -- if it stops running, these windows silently grow.
