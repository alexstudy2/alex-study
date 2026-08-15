"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  X,
  Check,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [dateDefaults] = useState(() => {
    const start = new Date();
    const deadline = new Date(start);
    deadline.setDate(deadline.getDate() + 7);
    return {
      start: start.toISOString().slice(0, 10),
      deadline: deadline.toISOString().slice(0, 10),
    };
  });

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
          <p className="eyebrow flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-accent" />
            {ar ? "خطة قابلة للقياس" : "Measurable direction"}
          </p>
          <h2>{ar ? "أهدافك الحالية" : "Your active goals"}</h2>
        </div>
        <Button
          variant={open ? "secondary" : "primary"}
          size="sm"
          leftIcon={open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          onClick={() => setOpen(!open)}
        >
          {open ? (ar ? "إغلاق" : "Close") : ar ? "هدف جديد" : "New goal"}
        </Button>
      </div>

      {open && (
        <form className="goal-form" action={create}>
          <label>
            {ar ? "عنوان الهدف" : "Goal title"}
            <input name="title" required maxLength={160} placeholder={ar ? "مثال: مراجعة 500 دقيقة تشريح" : "e.g. 500 study minutes"} />
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
              <input name="targetValue" type="number" min="1" required defaultValue="100" />
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
                <option value="">{ar ? "عام / بدون مادة" : "General / No subject"}</option>
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
              {ar ? "يبدأ في" : "Starts at"}
              <input
                name="startsAt"
                type="date"
                required
                defaultValue={dateDefaults.start}
              />
            </label>
            <label>
              {ar ? "الموعد النهائي" : "Deadline"}
              <input
                name="deadline"
                type="date"
                required
                defaultValue={dateDefaults.deadline}
              />
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={busy}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {ar ? "حفظ الهدف" : "Save goal"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {goals.length === 0 ? (
        <EmptyState
          title={ar ? "لا توجد أهداف نشطة بعد" : "No active goals yet"}
          description={
            ar
              ? "أنشئ هدفك الأول لمتابعة دقائق دراستك أو مهامك خطوة بخطوة."
              : "Create your first goal to track study minutes or task progress."
          }
          actionLabel={ar ? "هدف جديد" : "New goal"}
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="goal-cards">
          {goals.map((goal) => (
            <article key={goal.id} className="goal-card">
              <div className="goal-card-header">
                <div>
                  <span className="goal-period-tag">{goal.period}</span>
                  <h3>
                    <Link href={`/goals/${goal.id}`}>{goal.title}</Link>
                  </h3>
                </div>
                <span className={`goal-status-tag goal-${goal.status.toLowerCase()}`}>
                  {goal.status}
                </span>
              </div>
              <div className="goal-progress-wrap">
                <div className="goal-values">
                  <strong>
                    {goal.progress.currentValue} / {goal.targetValue}
                  </strong>
                  <span>{goal.progress.percentage}%</span>
                </div>
                <div className="dashboard-progress">
                  <i style={{ width: `${Math.min(100, goal.progress.percentage)}%` }} />
                </div>
              </div>
              <div className="goal-actions">
                {goal.status === "ACTIVE" && (
                  <>
                    <Button
                      variant="subtle"
                      size="sm"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => status(goal, "COMPLETED")}
                    >
                      {ar ? "إنجاز" : "Complete"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                      onClick={() => status(goal, "CANCELLED")}
                    >
                      {ar ? "إلغاء" : "Cancel"}
                    </Button>
                  </>
                )}
                <Link className="goal-detail-link" href={`/goals/${goal.id}`}>
                  {ar ? "التفاصيل ←" : "Details →"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
