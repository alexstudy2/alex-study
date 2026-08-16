/**
 * Creates two throwaway accounts (QA-AUDIT-A / QA-AUDIT-B) and fills the primary one
 * with realistic data through the app's own HTTP APIs, so the authenticated routes can
 * be visually audited. Nothing outside these two accounts is touched.
 * Tear down with: node scripts/audit-teardown.mjs
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
export const ACCOUNTS = {
  a: { collegeId: "QA-AUDIT-A", academicYear: 3, password: "AuditPass2026!", name: "Qa Audit Alpha" },
  b: { collegeId: "QA-AUDIT-B", academicYear: 3, password: "AuditPass2026!", name: "Qa Audit Beta" },
};

const iso = (d) => new Date(d).toISOString();
const DAY = 86400000;

async function register(page, acct) {
  const res = await page.request.post(`${BASE}/api/auth/register`, {
    data: {
      name: acct.name,
      collegeId: acct.collegeId,
      academicYear: acct.academicYear,
      password: acct.password,
      locale: "EN",
    },
  });
  console.log(`[register] ${acct.collegeId} -> ${res.status()}`);
  return res.status();
}

export async function signIn(page, acct) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="collegeId"]', acct.collegeId);
  await page.selectOption('select[name="academicYear"]', String(acct.academicYear));
  await page.fill('input[name="password"]', acct.password);
  await page.click("form.auth-form button.primary-button");
  await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30000 });
}

async function post(page, path, data) {
  const res = await page.request.post(`${BASE}${path}`, { data });
  const body = await res.json().catch(() => ({}));
  if (res.status() >= 300) console.log(`  ! POST ${path} ${res.status()} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  for (const acct of [ACCOUNTS.a, ACCOUNTS.b]) await register(page, acct);

  // ---------- account B: a couple of sessions so leaderboard/challenge has an opponent
  await signIn(page, ACCOUNTS.b);
  const bSubject = (await post(page, "/api/subjects", { name: "Pharmacology", colorToken: "violet" })).subject;
  await post(page, "/api/me/privacy", { leaderboardVisible: true });
  const now = Date.now();
  for (const [endHoursAgo, mins] of [[20, 55], [44, 40]]) {
    await post(page, "/api/sessions", {
      subjectId: bSubject?.id ?? null,
      startedAt: iso(now - endHoursAgo * 3600000 - mins * 60000),
      endedAt: iso(now - endHoursAgo * 3600000),
      plannedDurationSeconds: mins * 60,
      distractionCount: 1,
    });
  }
  const bId = (await (await page.request.get(`${BASE}/api/me`)).json().catch(() => ({})))?.user?.id;
  await ctx.clearCookies();

  // ---------- account A: the account the audit browses
  await signIn(page, ACCOUNTS.a);
  await post(page, "/api/me/privacy", { leaderboardVisible: true });

  const subjects = [];
  for (const [name, color] of [
    ["Anatomy", "coral"],
    ["Physiology", "teal"],
    // long name on purpose: stresses chips, table cells and card headers
    ["Clinical Biochemistry & Molecular Medicine", "amber"],
  ]) {
    const s = (await post(page, "/api/subjects", { name, colorToken: color })).subject;
    if (s) subjects.push(s);
  }

  const taskSpecs = [
    ["Review the brachial plexus branches", "HIGH", 45, 1, "TODO"],
    ["Cardiac cycle question bank", "MEDIUM", 30, 2, "TODO"],
    // deliberately very long, unbroken-ish title to catch overflow bugs
    [
      "Summarise the pathophysiology of congestive heart failure including neurohormonal compensation mechanisms and pharmacological targets",
      "URGENT",
      120,
      0,
      "TODO",
    ],
    ["Histology flashcards", "LOW", 25, 4, "TODO"],
    ["Overdue: renal clearance problems", "HIGH", 60, -3, "TODO"],
    ["Completed: upper limb spotter", "MEDIUM", 40, -1, "COMPLETED"],
    ["Completed: glossary sprint", "LOW", 15, -2, "COMPLETED"],
  ];
  const tasks = [];
  for (const [i, [title, priority, est, dueInDays, status]] of taskSpecs.entries()) {
    const t = (
      await post(page, "/api/tasks", {
        title,
        priority,
        status,
        estimatedMinutes: est,
        subjectId: subjects[i % subjects.length]?.id ?? null,
        dueAt: iso(now + dueInDays * DAY),
        notes: i === 2 ? "Long note to exercise the detail page layout. ".repeat(6) : null,
      })
    ).task;
    if (t) tasks.push(t);
  }
  // subtasks on the first task
  if (tasks[0])
    for (const title of ["Draw it from memory", "Check weak branches"])
      await post(page, "/api/tasks", { title, parentTaskId: tasks[0].id });

  // 14 days of sessions -> analytics charts, trend bars, session list
  for (let d = 1; d <= 14; d++) {
    const mins = 25 + ((d * 13) % 70);
    const end = now - d * DAY + 3600000 * 19;
    await post(page, "/api/sessions", {
      subjectId: subjects[d % subjects.length]?.id ?? null,
      startedAt: iso(end - mins * 60000),
      endedAt: iso(end),
      plannedDurationSeconds: (mins + 5) * 60,
      distractionCount: d % 4,
      reflection: d % 5 === 0 ? "Felt scattered at the start, better after the first block." : undefined,
    });
  }

  for (const [title, metric, target, period] of [
    ["Finish upper limb revision", "STUDY_MINUTES", 600, "WEEKLY"],
    ["Clear thirty tasks this month", "TASKS_COMPLETED", 30, "MONTHLY"],
  ]) {
    await post(page, "/api/goals", {
      title,
      metric,
      targetValue: target,
      period,
      subjectId: subjects[0]?.id ?? null,
      startsAt: iso(now - 2 * DAY),
      deadline: iso(now + 6 * DAY),
    });
  }

  await post(page, "/api/lobbies", {
    name: "Third year evening focus room",
    description: "Quiet evening Pomodoros after lectures, with a long description to test wrapping in the room card header.",
    visibility: "PRIVATE",
    chatEnabled: true,
    maxMembers: 12,
  });

  if (bId) {
    await post(page, "/api/friends/requests", { userId: bId });
    await post(page, "/api/challenges", {
      opponentId: bId,
      type: "STUDY_TIME",
      resolutionType: "DEADLINE_LEADER",
      targetValue: 300,
      startsAt: iso(now - 2 * DAY),
      endsAt: iso(now + 4 * DAY),
    });
  }

  writeFileSync("audit-out/accounts.json", JSON.stringify(ACCOUNTS, null, 2));
  console.log("[done] audit accounts ready");
  await browser.close();
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("audit-bootstrap")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
