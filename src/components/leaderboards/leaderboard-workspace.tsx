"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Trophy,
  Eye,
  EyeOff,
  RefreshCw,
  Award,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import type { LeaderboardRow } from "@/components/challenges/types";

type Payload = {
  rows: LeaderboardRow[];
  periodStart: string | Date;
  periodEnd: string | Date;
};

function formatWeek(start: string | Date, end: string | Date, locale: "en" | "ar") {
  const s = new Date(start);
  const e = new Date(end);
  const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(s)} – ${formatter.format(e)}`;
}

function metricLabel(
  val: number,
  metric: "STUDY_MINUTES" | "TASKS_COMPLETED",
  locale: "en" | "ar"
) {
  const ar = locale === "ar";
  if (metric === "STUDY_MINUTES") {
    return ar ? `${val} دقيقة دراسة` : `${val} study min`;
  }
  return ar ? `${val} مهام مكتملة` : `${val} tasks done`;
}

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
        ar ? "تعذر تحميل الترتيب الآن." : "The leaderboard could not be loaded right now."
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
        : "You are hidden from all leaderboards."
    );
  }

  const myRow = data.rows.find((row) => row.userId === userId);

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Trophy}
        eyebrow={ar ? "نشاط أسبوعي" : "Weekly activity"}
        title={ar ? "تقدم جماعي، بلا ضغط." : "Shared momentum, without the pressure."}
        description={
          ar
            ? "ترتيب أسبوعي للنشاط المؤهل فقط. الرتبة لحظة عابرة وليست تقييمًا لقدرتك أو قيمتك."
            : "A weekly view of eligible activity only. Rank is a temporary snapshot, not a judgment of ability or worth."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/friends">
              {ar ? "الأصدقاء" : "Friends"}
            </Link>
            <Link className="page-header-link" href="/challenges">
              {ar ? "التحديات" : "Challenges"}
            </Link>
          </div>
        }
      />

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
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />}
              onClick={() => load()}
            >
              {ar ? "تحديث" : "Refresh"}
            </Button>
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
                      <strong className="flex items-center gap-1">
                        {row.rank === 1 && <Trophy className="w-4 h-4 text-accent" />}
                        {row.rank === 2 && <Award className="w-4 h-4 text-muted" />}
                        {row.rank === 3 && <Award className="w-4 h-4 text-warning" />}
                        #{row.rank}
                      </strong>
                    </td>
                    <td>
                      <span className="student-name">{row.name}</span>
                    </td>
                    <td>
                      <span className="year-pill">
                        {row.academicYear
                          ? ar
                            ? row.academicYear === 6
                              ? "امتياز"
                              : `سنة ${row.academicYear}`
                            : row.academicYear === 6
                            ? "Intern"
                            : `Y${row.academicYear}`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {metric === "STUDY_MINUTES"
                          ? `${row.value} ${ar ? "دقيقة" : "min"}`
                          : `${row.value} ${ar ? "مهمة" : "tasks"}`}
                      </strong>
                    </td>
                    <td>
                      <span className="text-muted text-sm">
                        {metric === "STUDY_MINUTES"
                          ? `${row.secondaryValue} ${ar ? "مهام" : "tasks"}`
                          : `${row.secondaryValue} ${ar ? "دقيقة" : "min"}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="leaderboard-sidebar">
          <article className="privacy-card">
            <p className="eyebrow flex items-center gap-1">
              {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {ar ? "الخصوصية والظهور" : "Privacy & Visibility"}
            </p>
            <h3>{ar ? "أنت تتحكم بظهورك" : "You control your visibility"}</h3>
            <p>
              {ar
                ? "يمكنك إخفاء اسمك ونشاطك من جميع لوحات المتصدرين في أي وقت بضغطة واحدة."
                : "You can hide your name and activity from all public leaderboards anytime with one click."}
            </p>
            <Button
              variant={visible ? "secondary" : "primary"}
              size="sm"
              onClick={() => setPrivacy(!visible)}
            >
              {visible
                ? ar
                  ? "إخفاء اسمي من اللوحات"
                  : "Hide me from boards"
                : ar
                ? "إظهار اسمي في اللوحات"
                : "Show me on boards"}
            </Button>
          </article>
        </aside>
      </div>
    </PageShell>
  );
}
