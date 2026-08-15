"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock } from "lucide-react";

type DashboardTaskProps = {
  task: {
    id: string;
    title: string;
    estimatedMinutes: number | null;
    subject: {
      name: string;
      colorToken: string;
    } | null;
  };
  ar: boolean;
};

export function DashboardTaskItem({ task, ar }: DashboardTaskProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const router = useRouter();

  async function handleToggleComplete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isBusy) return;

    setIsBusy(true);
    const nextState = !isCompleted;
    setIsCompleted(nextState);

    try {
      const res = await fetch(`/api/tasks/${task.id}/${nextState ? "complete" : "reopen"}`, {
        method: "POST",
      });
      if (res.ok) {
        setTimeout(() => {
          router.refresh();
        }, 300);
      } else {
        setIsCompleted(!nextState);
      }
    } catch {
      setIsCompleted(!nextState);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      className={`dashboard-task-card ${isCompleted ? "task-completed-card" : ""}`}
      style={{
        transition: "all 0.2s ease",
        opacity: isCompleted ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={handleToggleComplete}
        disabled={isBusy}
        className="task-checkbox-btn"
        aria-label={ar ? "تحديد كمكتملة" : "Mark as completed"}
        title={ar ? "تحديد كمكتملة" : "Mark as completed"}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-success animate-bounce" />
        ) : (
          <Circle className="w-5 h-5 text-muted hover:text-primary transition-colors" />
        )}
      </button>

      <Link
        href={`/tasks/${task.id}`}
        className="dashboard-task-content flex-1 flex items-center justify-between gap-3 text-inherit no-underline"
      >
        <div className="flex flex-col gap-1 min-w-0">
          <strong
            className={`truncate text-sm font-bold ${
              isCompleted ? "line-through text-muted" : "text-foreground"
            }`}
          >
            {task.title}
          </strong>
          {task.subject && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted"
            >
              <span
                className="w-2 h-2 rounded-full border border-secondary"
                style={{ background: `var(--subject-${task.subject.colorToken.toLowerCase()}, var(--primary))` }}
              />
              {task.subject.name}
            </span>
          )}
        </div>

        {task.estimatedMinutes ? (
          <span className="task-pill flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-surface-sunken border border-secondary shrink-0">
            <Clock className="w-3 h-3 text-muted" />
            {task.estimatedMinutes} {ar ? "د" : "m"}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
