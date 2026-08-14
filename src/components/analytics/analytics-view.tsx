"use client";
import { useState } from "react";
import Link from "next/link";

type Data = {
  summary: {
    studyMinutes: number;
    plannedMinutes: number;
    tasksCompleted: number;
    tasksDue: number;
    distractionCount: number;
    averageFocusScore: number | null;
    completionRate: number;
  };
  daily: {
    date: string;
    minutes: number;
    plannedMinutes: number;
    tasksCompleted: number;
    distractions: number;
  }[];
  bySubject: { id: string; name: string; colorToken: string; minutes: number; sessions: number }[];
  byHour: { hour: number; minutes: number }[];
};
export function AnalyticsView({ initialData, locale }: { initialData: Data; locale: "en" | "ar" }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState("30");
  const [busy, setBusy] = useState(false);
  const ar = locale === "ar";
  async function change(value: string) {
    setRange(value);
    setBusy(true);
    const to = new Date();
    const from = new Date(to.getTime() - (Number(value) - 1) * 86400000);
    const response = await fetch(
      `/api/analytics/summary?from=${from.toISOString()}&to=${to.toISOString()}`,
    );
    if (response.ok) setData(await response.json());
    setBusy(false);
  }

  if (data.summary.studyMinutes === 0 || !data.daily || data.daily.length === 0) {
    return (
      <section className="analytics-view empty-state" dir={ar ? "rtl" : "ltr"} style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <h2 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{ar ? "لا توجد بيانات بعد" : "No data yet"}</h2>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>{ar ? "ابدأ أول جلسة تركيز لك" : "Start your first focus session"}</p>
        <Link href="/focus" className="primary-button" style={{ display: "inline-block", textDecoration: "none" }}>
          {ar ? "اذهب للتركيز" : "Go to Focus"}
        </Link>
      </section>
    );
  }

  const max = Math.max(1, ...data.daily.map((x) => x.minutes));
  return (
    <section className="analytics-view" dir={ar ? "rtl" : "ltr"}>
      <style>{`
        @media (max-width: 768px) {
          .analytics-summary {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
      <div className="analytics-toolbar">
        <label>
          {ar ? "الفترة" : "Range"}
          <select value={range} onChange={(e) => change(e.target.value)}>
            <option value="7">7 {ar ? "أيام" : "days"}</option>
            <option value="30">30 {ar ? "يومًا" : "days"}</option>
            <option value="90">90 {ar ? "يومًا" : "days"}</option>
          </select>
        </label>
        {busy && <span role="status">{ar ? "تحديث…" : "Updating…"}</span>}
      </div>
      <div className="analytics-summary">
        {[
          [ar ? "دقائق الدراسة" : "Study minutes", data.summary.studyMinutes],
          [ar ? "المخطط" : "Planned", data.summary.plannedMinutes],
          [ar ? "إكمال المهام" : "Task completion", `${data.summary.completionRate}%`],
          [ar ? "درجة التركيز" : "Focus Score", data.summary.averageFocusScore ?? "—"],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="analytics-panel">
        <h2>{ar ? "اتجاه الدراسة" : "Study trend"}</h2>
        <div
          className="trend-chart"
          role="img"
          aria-label={ar ? "رسم لدقائق الدراسة اليومية" : "Daily study minutes chart"}
        >
          {data.daily.map((day) => (
            <div key={day.date} title={`${day.date}: ${day.minutes} ${ar ? "دقيقة" : "min"}`}>
              <i style={{ height: `${Math.max(2, (day.minutes / max) * 100)}%` }} />
              <span>{day.date.slice(5)}</span>
            </div>
          ))}
        </div>
        <table>
          <caption>{ar ? "جدول دقائق الدراسة اليومية" : "Daily study minutes table"}</caption>
          <thead>
            <tr>
              <th>{ar ? "التاريخ" : "Date"}</th>
              <th>{ar ? "الفعلي" : "Actual"}</th>
              <th>{ar ? "المخطط" : "Planned"}</th>
              <th>{ar ? "المهام" : "Tasks"}</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((day) => (
              <tr key={day.date}>
                <td>{day.date}</td>
                <td>{day.minutes}</td>
                <td>{day.plannedMinutes}</td>
                <td>{day.tasksCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="analytics-columns">
        <section className="analytics-panel">
          <h2>{ar ? "حسب المادة" : "By subject"}</h2>
          {data.bySubject.map((item) => (
            <div className="subject-bar" key={item.id}>
              <span>{item.name}</span>
              <div>
                <i
                  style={{
                    width: `${(item.minutes / Math.max(1, data.summary.studyMinutes)) * 100}%`,
                    backgroundColor: `var(--${item.colorToken})`,
                  }}
                />
              </div>
              <strong>{item.minutes}</strong>
            </div>
          ))}
        </section>
        <section className="analytics-panel">
          <h2>{ar ? "الأوقات المنتجة" : "Productive times"}</h2>
          {data.byHour.map((item) => (
            <p key={item.hour}>
              <strong>{String(item.hour).padStart(2, "0")}:00</strong> · {item.minutes}{" "}
              {ar ? "دقيقة" : "min"}
            </p>
          ))}
        </section>
      </div>
    </section>
  );
}
