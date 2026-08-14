"use client";

import Link from "next/link";
import { useState } from "react";
import type { LeaderboardRow } from "@/components/challenges/types";

type Payload = {
  rows: LeaderboardRow[];
  periodStart: string | Date;
  periodEnd: string | Date;
};

export function LeaderboardWorkspace({
  userId,
  locale,
  initial,
  initialVisible,
}: {
  userId: string;
  locale: "en" | "ar";
  initial: Payload;
  initialVisible: boolean;
}) {
  const ar = locale === "ar";
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [metric, setMetric] = useState<"STUDY_MINUTES" | "TASKS_COMPLETED">("STUDY_MINUTES");
  const [academicYear, setAcademicYear] = useState("");
  const [data, setData] = useState(initial);
  const [visible, setVisible] = useState(initialVisible);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load(nextScope = scope, nextMetric = metric, nextYear = academicYear) {
    setBusy(true);
    setMessage("");
    const query = new URLSearchParams({ metric: nextMetric });
    if (nextScope === "global" && nextYear) query.set("academicYear", nextYear);
    const response = await fetch(`/api/leaderboards/${nextScope}?${query}`, { cache: "no-store" });
    if (response.ok) setData(await response.json());
    else
      setMessage(
        ar ? "تعذر تحميل الترتيب الآن." : "The leaderboard could not be loaded right now.",
      );
    setBusy(false);
  }

  async function setPrivacy(next: boolean) {
    setVisible(next);
    const response = await fetch("/api/me/privacy", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leaderboardVisible: next }),
    });
    if (!response.ok) {
      setVisible(!next);
      setMessage(ar ? "تعذر تحديث الخصوصية." : "Privacy could not be updated.");
      return;
    }
    await load();
    setMessage(
      next
        ? ar
          ? "أصبحت ظاهرًا في لوحات هذا الأسبوع."
          : "You are visible on this week’s boards."
        : ar
          ? "تم إخفاؤك من جميع لوحات المتصدرين."
          : "You are hidden from all leaderboards.",
    );
  }

  const myRow = data.rows.find((row) => row.userId === userId);
  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="leaderboard-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "نشاط أسبوعي" : "Weekly activity"}</p>
          <h1>{ar ? "تقدم جماعي، بلا ضغط." : "Shared momentum, without the pressure."}</h1>
          <p>
            {ar
              ? "ترتيب أسبوعي للنشاط المؤهل فقط. الرتبة لحظة عابرة وليست تقييمًا لقدرتك أو قيمتك."
              : "A weekly view of eligible activity only. Rank is a temporary snapshot, not a judgment of ability or worth."}
          </p>
        </div>
        <nav
          className="page-header"
          aria-label={ar ? "التنقل الاجتماعي" : "Social navigation"}
        >
          <Link className="secondary-button" href="/friends">
            {ar ? "الأصدقاء" : "Friends"}
          </Link>
          <Link className="primary-button" href="/challenges">
            {ar ? "التحديات" : "Challenges"}
          </Link>
        </nav>
      </header>

      <section
        className="leaderboard-controls"
        aria-label={ar ? "خيارات لوحة المتصدرين" : "Leaderboard options"}
      >
        <div className="segmented-control" role="tablist" aria-label={ar ? "النطاق" : "Scope"}>
          <button
            role="tab"
            aria-selected={scope === "global"}
            onClick={() => {
              setScope("global");
              load("global");
            }}
          >
            {ar ? "كل طلاب الكلية" : "All College Students"}
          </button>
          <button
            role="tab"
            aria-selected={scope === "friends"}
            onClick={() => {
              setScope("friends");
              setAcademicYear("");
              load("friends", metric, "");
            }}
          >
            {ar ? "الأصدقاء" : "Friends"}
          </button>
        </div>
        <div className="leaderboard-filter-row">
          <div className="segmented-control compact" aria-label={ar ? "المقياس" : "Metric"}>
            <button
              aria-pressed={metric === "STUDY_MINUTES"}
              onClick={() => {
                setMetric("STUDY_MINUTES");
                load(scope, "STUDY_MINUTES");
              }}
            >
              {ar ? "دقائق الدراسة" : "Study minutes"}
            </button>
            <button
              aria-pressed={metric === "TASKS_COMPLETED"}
              onClick={() => {
                setMetric("TASKS_COMPLETED");
                load(scope, "TASKS_COMPLETED");
              }}
            >
              {ar ? "المهام" : "Tasks completed"}
            </button>
          </div>
          {scope === "global" && (
            <label>
              <span>{ar ? "السنة الدراسية" : "Academic year"}</span>
              <select
                value={academicYear}
                onChange={(event) => {
                  const next = event.target.value;
                  setAcademicYear(next);
                  load("global", metric, next);
                }}
              >
                <option value="">{ar ? "كل السنوات" : "All years"}</option>
                {[1, 2, 3, 4, 5, 6].map((year) => (
                  <option key={year} value={year}>
                    {ar
                      ? year === 6
                        ? "سنة الامتياز"
                        : `السنة ${year}`
                      : year === 6
                        ? "Internship"
                        : `Year ${year}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {message && (
        <p className="challenge-feedback" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <section className="leaderboard-summary">
        <div>
          <p className="eyebrow">{ar ? "أسبوع UTC" : "UTC week"}</p>
          <h2>{formatWeek(data.periodStart, data.periodEnd, locale)}</h2>
          <p>
            {ar
              ? "يبدأ الترتيب العالمي يوم الاثنين 00:00 بالتوقيت العالمي. حدودك الشخصية تظل بتوقيت القاهرة."
              : "Global ranking resets Monday at 00:00 UTC. Your personal planning boundaries remain in Cairo time."}
          </p>
        </div>
        <div className="my-rank">
          <span>{ar ? "موقعك الحالي" : "Your current place"}</span>
          <strong>{visible && myRow ? `#${myRow.rank}` : "—"}</strong>
          <small>
            {visible
              ? myRow
                ? metricLabel(myRow.value, metric, locale)
                : ar
                  ? "لا يوجد نشاط مؤهل بعد"
                  : "No eligible activity yet"
              : ar
                ? "أنت مخفي حاليًا"
                : "You are currently hidden"}
          </small>
        </div>
      </section>

      <div className="leaderboard-layout">
        <section className="leaderboard-table-panel" aria-busy={busy}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {scope === "global" ? (ar ? "الكلية" : "College") : ar ? "دائرتك" : "Your circle"}
              </p>
              <h2>
                {metric === "STUDY_MINUTES"
                  ? ar
                    ? "دقائق الدراسة المؤهلة"
                    : "Eligible study minutes"
                  : ar
                    ? "المهام المؤهلة"
                    : "Eligible tasks"}
              </h2>
            </div>
            <button className="text-button" disabled={busy} onClick={() => load()}>
              {ar ? "تحديث" : "Refresh"}
            </button>
          </div>
          <div className="leaderboard-table-wrap">
            <table>
              <caption className="sr-only">
                {ar ? "ترتيب النشاط الأسبوعي" : "Weekly activity ranking"}
              </caption>
              <thead>
                <tr>
                  <th>{ar ? "الرتبة" : "Rank"}</th>
                  <th>{ar ? "الطالب" : "Student"}</th>
                  <th>{ar ? "السنة" : "Year"}</th>
                  <th>{ar ? "القيمة" : "Total"}</th>
                  <th>{ar ? "المقياس المساند" : "Other activity"}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.userId} data-self={row.userId === userId}>
                    <td>
                      <strong>#{row.rank}</strong>
                    </td>
                    <td>
                      <span className="leaderboard-person">
                        <i aria-hidden="true">{row.name.slice(0, 1).toUpperCase()}</i>
                        <span>
                          <strong>{row.name}</strong>
                          {row.userId === userId && <small>{ar ? "أنت" : "You"}</small>}
                        </span>
                      </span>
                    </td>
                    <td>{row.academicYear}</td>
                    <td>
                      <strong>{metricLabel(row.value, metric, locale)}</strong>
                    </td>
                    <td>
                      {metricLabel(
                        row.secondaryValue,
                        metric === "STUDY_MINUTES" ? "TASKS_COMPLETED" : "STUDY_MINUTES",
                        locale,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.rows.length && (
              <div className="challenge-empty">
                <h3>{ar ? "لا توجد نتائج ظاهرة بعد." : "No visible results yet."}</h3>
                <p>
                  {ar
                    ? "قد يكون الطلاب قد أوقفوا الظهور، أو لم يسجلوا نشاطًا مؤهلًا هذا الأسبوع."
                    : "Students may have opted out, or no eligible activity has been logged this week."}
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="leaderboard-privacy-panel">
          <p className="eyebrow">{ar ? "الخصوصية" : "Privacy"}</p>
          <h2>{ar ? "أنت تتحكم في ظهورك." : "You control your visibility."}</h2>
          <label className="privacy-toggle">
            <input
              type="checkbox"
              checked={visible}
              onChange={(event) => setPrivacy(event.target.checked)}
            />
            <span>
              <strong>{ar ? "الظهور في لوحات المتصدرين" : "Appear on leaderboards"}</strong>
              <small>
                {ar
                  ? "ينطبق على كل طلاب الكلية والأصدقاء."
                  : "Applies to All College Students and friends boards."}
              </small>
            </span>
          </label>
          <ul>
            <li>{ar ? "لا يظهر رقمك الجامعي." : "Your college ID is never displayed."}</li>
            <li>{ar ? "الجلسات اليدوية غير محتسبة." : "Manual sessions are excluded."}</li>
            <li>
              {ar
                ? "المهام الأقل من 10 دقائق غير محتسبة."
                : "Tasks under 10 estimated minutes are excluded."}
            </li>
            <li>
              {ar ? "القيم المتساوية تحصل على نفس الرتبة." : "Equal totals receive the same rank."}
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

function metricLabel(
  value: number,
  metric: "STUDY_MINUTES" | "TASKS_COMPLETED",
  locale: "en" | "ar",
) {
  if (locale === "ar") return metric === "STUDY_MINUTES" ? `${value} دقيقة` : `${value} مهمة`;
  return metric === "STUDY_MINUTES" ? `${value} min` : `${value} task${value === 1 ? "" : "s"}`;
}

function formatWeek(start: string | Date, end: string | Date, locale: "en" | "ar") {
  const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const inclusiveEnd = new Date(new Date(end).getTime() - 1);
  return `${formatter.format(new Date(start))} – ${formatter.format(inclusiveEnd)}`;
}
