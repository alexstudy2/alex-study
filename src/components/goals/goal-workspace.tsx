"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  X,
  Check,
  Ban,
  Clock,
  CheckSquare,
  Sparkles,
  Calendar,
  BookOpen,
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
  const [selectedMetric, setSelectedMetric] = useState<"STUDY_MINUTES" | "TASKS_COMPLETED">(
    "STUDY_MINUTES"
  );
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
        metric: selectedMetric,
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
        <div className="goal-form-wrapper">
          <div className="goal-form-tape" aria-hidden="true" />
          <form className="goal-doodle-form" action={create}>
            <div className="goal-form-header">
              <div className="flex items-center gap-2">
                <div className="goal-header-icon-bubble">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    {ar ? "إضافة هدف دراسي جديد" : "Create New Study Goal"}
                  </h3>
                  <p className="text-xs text-muted">
                    {ar
                      ? "حدد هدفك بدقة لزيادة التركيز ومتابعة التقدم خطوة بخطوة."
                      : "Set a clear, measurable goal to maintain momentum."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="goal-form-close-btn"
                aria-label={ar ? "إغلاق" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="goal-form-body">
              {/* Title Field */}
              <div className="goal-form-field">
                <label htmlFor="goal-title">
                  {ar ? "عنوان الهدف" : "Goal title"}
                  <span className="text-danger ml-1">*</span>
                </label>
                <input
                  id="goal-title"
                  name="title"
                  required
                  maxLength={160}
                  placeholder={
                    ar
                      ? "مثال: مراجعة 500 دقيقة تشريح أو إنهاء 10 مهام"
                      : "e.g. 500 study minutes or finish 10 tasks"
                  }
                />
              </div>

              {/* Metric Selector Tabs */}
              <div className="goal-form-field">
                <label>{ar ? "طريقة قياس الهدف (المقياس)" : "Goal Metric"}</label>
                <div className="goal-metric-tabs">
                  <button
                    type="button"
                    onClick={() => setSelectedMetric("STUDY_MINUTES")}
                    className={`goal-metric-tab-btn ${
                      selectedMetric === "STUDY_MINUTES" ? "active" : ""
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{ar ? "دقائق الدراسة" : "Study Minutes"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMetric("TASKS_COMPLETED")}
                    className={`goal-metric-tab-btn ${
                      selectedMetric === "TASKS_COMPLETED" ? "active" : ""
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>{ar ? "المهام المكتملة" : "Tasks Completed"}</span>
                  </button>
                </div>
              </div>

              {/* Target Value & Period Grid */}
              <div className="goal-form-grid">
                <div className="goal-form-field">
                  <label htmlFor="goal-target">
                    {ar ? "القيمة المستهدفة" : "Target value"} (
                    {selectedMetric === "STUDY_MINUTES"
                      ? ar
                        ? "دقيقة"
                        : "minutes"
                      : ar
                      ? "مهمة"
                      : "tasks"}
                    )<span className="text-danger ml-1">*</span>
                  </label>
                  <input
                    id="goal-target"
                    name="targetValue"
                    type="number"
                    min="1"
                    required
                    defaultValue={selectedMetric === "STUDY_MINUTES" ? "120" : "5"}
                  />
                </div>

                <div className="goal-form-field">
                  <label htmlFor="goal-period">
                    {ar ? "فترة الهدف" : "Period"}
                  </label>
                  <select id="goal-period" name="period" defaultValue="WEEKLY">
                    <option value="WEEKLY">{ar ? "📅 أسبوعي (Weekly)" : "📅 Weekly"}</option>
                    <option value="MONTHLY">{ar ? "🗓️ شهري (Monthly)" : "🗓️ Monthly"}</option>
                    <option value="CUSTOM">{ar ? "🎯 مخصص (Custom)" : "🎯 Custom"}</option>
                  </select>
                </div>
              </div>

              {/* Subject & Dates Grid */}
              <div className="goal-form-grid">
                <div className="goal-form-field">
                  <label htmlFor="goal-subject">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-primary" />
                      {ar ? "المادة الدراسية (اختياري)" : "Subject (optional)"}
                    </span>
                  </label>
                  <select id="goal-subject" name="subjectId" defaultValue="">
                    <option value="">{ar ? "🌟 عام / كل المواد" : "🌟 General / All subjects"}</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="goal-form-field">
                    <label htmlFor="goal-start">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted" />
                        {ar ? "البدء" : "Starts"}
                      </span>
                    </label>
                    <input
                      id="goal-start"
                      name="startsAt"
                      type="date"
                      required
                      defaultValue={dateDefaults.start}
                    />
                  </div>

                  <div className="goal-form-field">
                    <label htmlFor="goal-deadline">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-danger" />
                        {ar ? "الانتهاء" : "Deadline"}
                      </span>
                    </label>
                    <input
                      id="goal-deadline"
                      name="deadline"
                      type="date"
                      required
                      defaultValue={dateDefaults.deadline}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="goal-form-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={busy}
                leftIcon={<Check className="w-4 h-4" />}
              >
                {busy ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ الهدف" : "Save goal"}
              </Button>
            </div>
          </form>
        </div>
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
                    {goal.progress.currentValue} / {goal.targetValue}{" "}
                    <span className="text-xs font-normal text-muted">
                      {goal.metric === "STUDY_MINUTES"
                        ? ar
                          ? "دقيقة"
                          : "mins"
                        : ar
                        ? "مهمة"
                        : "tasks"}
                    </span>
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
