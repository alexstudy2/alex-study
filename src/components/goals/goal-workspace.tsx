"use client";
import { useState } from "react";
import Link from "next/link";
import type { Goal } from "./types";

type Subject = { id: string; name: string; colorToken: string };
export function GoalWorkspace({
  initialGoals,
  subjects,
  locale,
}: {
  initialGoals: Goal[];
  subjects: Subject[];
  locale: "en" | "ar";
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ar = locale === "ar";
  async function create(form: FormData) {
    setBusy(true);
    setError("");
    const startsAt = new Date(String(form.get("startsAt")) + "T00:00:00+03:00");
    const deadline = new Date(String(form.get("deadline")) + "T23:59:59+03:00");
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        subjectId: form.get("subjectId") || null,
        metric: form.get("metric"),
        targetValue: Number(form.get("targetValue")),
        period: form.get("period"),
        startsAt: startsAt.toISOString(),
        deadline: deadline.toISOString(),
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      setGoals([
        { ...payload.goal, progress: { currentValue: 0, percentage: 0, complete: false } },
        ...goals,
      ]);
      setOpen(false);
    } else setError(ar ? "تعذر حفظ الهدف." : "The goal could not be saved.");
    setBusy(false);
  }
  async function status(goal: Goal, value: "COMPLETED" | "CANCELLED") {
    const response = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: value }),
    });
    if (response.ok)
      setGoals(goals.map((item) => (item.id === goal.id ? { ...item, status: value } : item)));
  }
  return (
    <section className="goal-workspace" dir={ar ? "rtl" : "ltr"}>
      <div className="goal-toolbar">
        <div>
          <p className="eyebrow">{ar ? "خطة قابلة للقياس" : "Measurable direction"}</p>
          <h2>{ar ? "أهدافك الحالية" : "Your active goals"}</h2>
        </div>
        <button className="primary-button" onClick={() => setOpen(!open)}>
          {open ? (ar ? "إغلاق" : "Close") : ar ? "هدف جديد" : "New goal"}
        </button>
      </div>
      {open && (
        <form className="goal-form" action={create}>
          <label>
            {ar ? "عنوان الهدف" : "Goal title"}
            <input name="title" required maxLength={160} />
          </label>
          <div className="form-grid">
            <label>
              {ar ? "المقياس" : "Metric"}
              <select name="metric">
                <option value="STUDY_MINUTES">{ar ? "دقائق الدراسة" : "Study minutes"}</option>
                <option value="TASKS_COMPLETED">
                  {ar ? "المهام المكتملة" : "Tasks completed"}
                </option>
              </select>
            </label>
            <label>
              {ar ? "القيمة المستهدفة" : "Target value"}
              <input name="targetValue" type="number" min="1" required />
            </label>
          </div>
          <div className="form-grid">
            <label>
              {ar ? "الفترة" : "Period"}
              <select name="period">
                <option value="WEEKLY">{ar ? "أسبوعي" : "Weekly"}</option>
                <option value="MONTHLY">{ar ? "شهري" : "Monthly"}</option>
                <option value="CUSTOM">{ar ? "مخصص" : "Custom"}</option>
              </select>
            </label>
            <label>
              {ar ? "المادة" : "Subject"}
              <select name="subjectId">
                <option value="">{ar ? "كل المواد" : "All subjects"}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              {ar ? "تاريخ البدء" : "Starts"}
              <input name="startsAt" type="date" required />
            </label>
            <label>
              {ar ? "الموعد النهائي" : "Deadline"}
              <input name="deadline" type="date" required />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {ar ? "حفظ الهدف" : "Save goal"}
          </button>
        </form>
      )}
      <div className="goal-grid">
        {goals.length ? (
          goals.map((goal) => (
            <article className="goal-card" key={goal.id}>
              <div className="goal-card-head">
                <span>{goal.subject?.name ?? (ar ? "كل المواد" : "All subjects")}</span>
                <span>{goal.status}</span>
              </div>
              <h3>
                <Link href={`/goals/${goal.id}`}>{goal.title}</Link>
              </h3>
              <div
                className="goal-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={goal.progress.percentage}
              >
                <span style={{ width: `${goal.progress.percentage}%` }} />
              </div>
              <div className="goal-numbers">
                <strong>
                  {goal.progress.currentValue} / {goal.targetValue}
                </strong>
                <span>{goal.progress.percentage}%</span>
              </div>
              {goal.status === "ACTIVE" && (
                <div className="goal-actions">
                  <button onClick={() => status(goal, "COMPLETED")}>
                    {ar ? "تم" : "Mark complete"}
                  </button>
                  <button onClick={() => status(goal, "CANCELLED")}>
                    {ar ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="session-state">
            <h3>{ar ? "لا توجد أهداف بعد" : "No goals yet"}</h3>
            <p>{ar ? "حوّل نيتك إلى رقم وموعد." : "Turn an intention into a number and a date."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
