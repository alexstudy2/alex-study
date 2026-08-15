"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ListTodo,
  Plus,
  CalendarCheck,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { DashboardTaskItem } from "@/components/dashboard/dashboard-task-item";
import { Button } from "@/components/ui/button";

export type DashboardTaskType = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  subject: {
    name: string;
    colorToken: string;
  } | null;
};

interface TodayTasksStickyProps {
  tasks: DashboardTaskType[];
  ar: boolean;
}

export function TodayTasksSticky({ tasks, ar }: TodayTasksStickyProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const NavArrow = ar ? ArrowLeft : ArrowRight;

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
        }),
      });

      if (res.ok) {
        setTaskTitle("");
        setIsAdding(false);
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
          <div className="sticky-empty-state">
            <div className="sticky-empty-doodle">
              <CalendarCheck className="w-8 h-8 text-primary opacity-80" />
            </div>
            <strong className="sticky-empty-title">
              {ar ? "لا توجد مهام مستحقة لليوم" : "No tasks due today"}
            </strong>
            <p className="sticky-empty-text">
              {ar
                ? "قائمتك خالية! أضف مهمة جديدة للبدء في إنجازها اليوم."
                : "Your list is clear! Add a task to start making progress today."}
            </p>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="sticky-empty-add-btn"
              >
                <Plus className="w-4 h-4" />
                <span>{ar ? "أضف مهمة لليوم" : "Add a task for today"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
