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
      /* Lower-cased because the [data-color] rules in components.css match the colorToken enum
         exactly as it is written in src/lib/tasks/validation.ts, which is lower case, while the
         column is a bare String and so cannot promise the casing the enum implies. Absent when
         there is no course -- the card's background and spine both have their own fallback for
         that, so an empty attribute would be the only broken case. */
      data-color={task.subject?.colorToken.toLowerCase()}
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
            className={`dashboard-task-title truncate ${
              isCompleted ? "line-through text-muted" : "text-foreground"
            }`}
          >
            {task.title}
          </strong>
          {task.subject && (
            <span className="dashboard-task-subject">
              {/* The shared dot, reading the --subject-color the card already resolved, instead of
                  a hand-rolled inline `var(--subject-${token})`. Same colour, one definition, and
                  it stays in step with the /tasks page when either changes. */}
              <span className="subject-dot shrink-0" aria-hidden="true" />
              {/* `truncate` on the name, not on the row: the row is an inline-flex box, and
                  text-overflow does not ellipsize flex items -- it would have clipped mid-letter
                  with no ellipsis. */}
              <span className="truncate">{task.subject.name}</span>
            </span>
          )}
        </div>

        {task.estimatedMinutes ? (
          <span className="task-pill flex items-center gap-1 px-2 py-0.5 shrink-0">
            <Clock className="w-3 h-3 text-muted" />
            {task.estimatedMinutes} {ar ? "د" : "m"}
          </span>
        ) : null}
      </Link>
    </div>
  );
}
