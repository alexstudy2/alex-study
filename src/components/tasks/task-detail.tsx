"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TaskForm } from "./task-form";
import type { Subject, Subtask, Task } from "./types";
export function TaskDetail({
  task,
  subjects,
  locale,
}: {
  task: Task;
  subjects: Subject[];
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  async function refresh() {
    router.refresh();
    setEditing(false);
    setSubtaskOpen(false);
  }
  async function remove() {
    if (!confirm(ar ? "حذف هذه المهمة؟" : "Delete this task?")) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (response.ok) router.push("/tasks");
  }
  async function toggleSubtask(subtask: Subtask) {
    await fetch(`/api/tasks/${subtask.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: subtask.status === "COMPLETED" ? "TODO" : "COMPLETED" }),
    });
    router.refresh();
  }
  return (
    <main className="detail-shell">
      <Link href="/tasks" className="back-link">
        ← {ar ? "كل المهام" : "All tasks"}
      </Link>
      <header className="detail-header">
        <div>
          <p className="eyebrow">{task.subject?.name ?? (ar ? "مهمة شخصية" : "Personal task")}</p>
          <h1>{task.title}</h1>
          <div className="task-meta">
            <span className={`priority priority-${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
            {task.dueAt && (
              <time>
                {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                  dateStyle: "full",
                  timeStyle: "short",
                }).format(new Date(task.dueAt))}
              </time>
            )}
            {task.estimatedMinutes && (
              <span>
                {task.estimatedMinutes} {ar ? "دقيقة" : "minutes"}
              </span>
            )}
          </div>
        </div>
        <div className="form-actions">
          <button className="secondary-button" onClick={() => setEditing(!editing)}>
            {ar ? "تعديل" : "Edit"}
          </button>
          <button className="danger-button" onClick={remove}>
            {ar ? "حذف" : "Delete"}
          </button>
        </div>
      </header>
      {editing ? (
        <section className="editor-panel">
          <TaskForm
            subjects={subjects}
            locale={locale}
            initial={task}
            onSaved={refresh}
            onCancel={() => setEditing(false)}
          />
        </section>
      ) : (
        task.notes && (
          <section className="detail-notes">
            <h2>{ar ? "ملاحظات" : "Notes"}</h2>
            <p>{task.notes}</p>
          </section>
        )
      )}
      <section className="subtask-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{ar ? "خطوات أصغر" : "Smaller steps"}</p>
            <h2>{ar ? "المهام الفرعية" : "Subtasks"}</h2>
          </div>
          <button className="secondary-button" onClick={() => setSubtaskOpen(true)}>
            + {ar ? "إضافة خطوة" : "Add step"}
          </button>
        </div>
        {subtaskOpen && (
          <div className="editor-panel">
            <TaskForm
              subjects={subjects}
              locale={locale}
              parentTaskId={task.id}
              onSaved={refresh}
              onCancel={() => setSubtaskOpen(false)}
            />
          </div>
        )}
        <div className="subtask-list">
          {task.subtasks.length ? (
            task.subtasks.map((subtask) => (
              <label key={subtask.id} className="subtask-row">
                <input
                  type="checkbox"
                  checked={subtask.status === "COMPLETED"}
                  onChange={() => toggleSubtask(subtask)}
                />
                <span>{subtask.title}</span>
                {subtask.estimatedMinutes && (
                  <small>
                    {subtask.estimatedMinutes} {ar ? "د" : "min"}
                  </small>
                )}
              </label>
            ))
          ) : (
            <p className="muted-copy">
              {ar
                ? "قسّم المهمة عندما تحتاج إلى بداية أسهل."
                : "Break this down when you need an easier place to start."}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
