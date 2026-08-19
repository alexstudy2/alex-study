"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ListTodo,
  Plus,
  ArrowRight,
  ArrowLeft,
  X,
  HeartPulse,
  Timer,
  CalendarDays,
} from "lucide-react";
import { DashboardTaskItem } from "@/components/dashboard/dashboard-task-item";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EcgTrace } from "@/components/ui/medical-doodles";
import { Select } from "@/components/ui/select";

export type DashboardTaskType = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  subject: {
    name: string;
    colorToken: string;
  } | null;
};

/** Just enough of a course to fill the picker and colour its swatch. */
export type DashboardSubjectType = {
  id: string;
  name: string;
  colorToken: string;
};

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface TodayTasksStickyProps {
  tasks: DashboardTaskType[];
  subjects: DashboardSubjectType[];
  ar: boolean;
}

export function TodayTasksSticky({ tasks, subjects, ar }: TodayTasksStickyProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const NavArrow = ar ? ArrowLeft : ArrowRight;
  const chosenSubject = subjects.find((s) => s.id === subjectId) ?? null;

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");

    try {
      const now = new Date();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          status: "TODO",
          dueAt: now.toISOString(),
          /* Both already accepted by taskInputSchema -- the quick-add was simply never sending
             them, so everything filed from the dashboard landed with no course and the default
             priority, and had to be opened and edited afterwards. */
          subjectId: subjectId || null,
          priority,
        }),
      });

      if (res.ok) {
        setTaskTitle("");
        setIsAdding(false);
        /* Course and priority deliberately survive the submit. Filing three tasks for the same
           course in a row is the common case, and re-picking it each time is the friction this
           row is meant to remove. */
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || (ar ? "تعذر إنشاء المهمة" : "Failed to create task"));
      }
    } catch {
      setError(ar ? "حدث خطأ في الاتصال" : "Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="today-tasks-sticky-card">
      {/* Washi Tape Header Decoration */}
      <div className="sticky-tape-top" aria-hidden="true" />

      {/* Card Header */}
      <div className="sticky-tasks-header">
        <div className="flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-primary" />
          <h2 className="sticky-tasks-title">
            {ar ? "مهام اليوم" : "Today's Tasks"}
          </h2>
          <span className="counter-pill font-mono">{tasks.length}</span>
        </div>

        <div className="flex items-center gap-2">
          {!isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="sticky-add-btn"
              title={ar ? "إضافة مهمة جديدة" : "Add new task"}
            >
              <Plus className="w-4 h-4" />
              <span className="text-xs font-bold">
                {ar ? "إضافة مهمة" : "Add Task"}
              </span>
            </button>
          )}

          <Link
            href="/tasks"
            className="sticky-view-all-link"
          >
            {ar ? "عرض الكل" : "View all"}
            <NavArrow className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Inline Quick Add Form on the Sticky Note */}
      {isAdding && (
        <form onSubmit={handleCreateTask} className="sticky-inline-add-form">
          <div className="sticky-input-row">
            <input
              ref={inputRef}
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder={ar ? "اكتب مهمة لليوم واضغط Enter..." : "Type today's task and press Enter..."}
              disabled={isSubmitting}
              className="sticky-task-input"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !taskTitle.trim()}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{ar ? "إضافة" : "Add"}</span>
              </Button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setTaskTitle("");
                  setError("");
                }}
                className="sticky-cancel-btn"
                aria-label={ar ? "إلغاء" : "Cancel"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Second line: which course, and how urgent. Below the title rather than beside it so
              Enter-to-submit stays the fast path and these stay optional adjustments. */}
          <div className="sticky-meta-row">
            <div className="sticky-field">
              {/* Live swatch. Its whole job is to make the colour on the board predictable
                  before the task exists -- dashed and hollow while no course is picked. */}
              <span
                className="sticky-course-swatch"
                data-color={chosenSubject?.colorToken}
                data-empty={chosenSubject ? "no" : "yes"}
                aria-hidden="true"
              />
              <Select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={isSubmitting}
                aria-label={ar ? "المقرر" : "Course"}
                className="sticky-select"
              >
                <option value="">{ar ? "بدون مقرر" : "No course"}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="sticky-field" data-priority={priority.toLowerCase()}>
              <span className="sticky-priority-spine" aria-hidden="true" />
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isSubmitting}
                aria-label={ar ? "الأولوية" : "Priority"}
                className="sticky-select"
              >
                <option value="LOW">{ar ? "أولوية منخفضة" : "Low priority"}</option>
                <option value="MEDIUM">{ar ? "أولوية متوسطة" : "Medium priority"}</option>
                <option value="HIGH">{ar ? "أولوية عالية" : "High priority"}</option>
                <option value="URGENT">{ar ? "أولوية عاجلة" : "Urgent"}</option>
              </Select>
            </div>
          </div>

          {error && <p className="text-xs text-danger font-semibold mt-1">{error}</p>}
        </form>
      )}

      {/* Tasks List / Empty State */}
      <div className="sticky-tasks-list">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <DashboardTaskItem key={task.id} task={task} ar={ar} />
          ))
        ) : (
          /* The shared EmptyState, not a fourth hand-rolled one -- it already takes an
             arbitrary node for the illustration and a children slot for extra actions, which
             is exactly the shape this needs. */
          <EmptyState
            className="sticky-empty-state"
            icon={
              <span className="empty-scene" aria-hidden="true">
                <HeartPulse className="empty-scene-glyph" />
                <EcgTrace className="empty-scene-ecg" variant="flatline" />
                <span className="empty-stamp">{ar ? "لا مستحقات" : "All clear"}</span>
              </span>
            }
            title={ar ? "لا مهام مستحقة اليوم" : "Nothing due today"}
            description={
              ar
                ? "يومك خالٍ تمامًا. أضف مهمة لليوم، أو استغل الوقت في جلسة تركيز أو تخطيط الغد."
                : "Your day is completely clear. Add something for today, or spend the time on a focus session or planning tomorrow."
            }
            actionLabel={isAdding ? undefined : ar ? "أضف مهمة لليوم" : "Add a task for today"}
            onAction={() => setIsAdding(true)}
          >
            <div className="empty-actions">
              <Button
                variant="secondary"
                size="sm"
                href="/focus"
                leftIcon={<Timer className="w-4 h-4" />}
              >
                {ar ? "ابدأ جلسة تركيز" : "Start a focus session"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                href="/calendar"
                leftIcon={<CalendarDays className="w-4 h-4" />}
              >
                {ar ? "خطِّط للغد" : "Plan tomorrow"}
              </Button>
            </div>
          </EmptyState>
        )}
      </div>
    </div>
  );
}
