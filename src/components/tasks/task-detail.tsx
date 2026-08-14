"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Trash2,
  Plus,
  Calendar,
  Clock,
  BookOpen,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
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
    <PageShell size="narrow" dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        backHref="/tasks"
        backLabel={ar ? "كل المهام" : "All tasks"}
        isRtl={ar}
        eyebrow={task.subject?.name ?? (ar ? "مهمة شخصية" : "Personal task")}
        title={task.title}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={() => setEditing(!editing)}
            >
              {ar ? "تعديل" : "Edit"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={remove}
            >
              {ar ? "حذف" : "Delete"}
            </Button>
          </div>
        }
      >
        <div className="task-meta mt-2 flex flex-wrap items-center gap-3">
          <span className={`priority priority-${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
          {task.dueAt && (
            <time className="flex items-center gap-1 text-sm text-muted">
              <Calendar className="w-3.5 h-3.5" />
              {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                dateStyle: "full",
                timeStyle: "short",
              }).format(new Date(task.dueAt))}
            </time>
          )}
          {task.estimatedMinutes && (
            <span className="flex items-center gap-1 text-sm text-muted">
              <Clock className="w-3.5 h-3.5" />
              {task.estimatedMinutes} {ar ? "دقيقة" : "minutes"}
            </span>
          )}
        </div>
      </PageHeader>

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

      <section className="subtask-section mt-8">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{ar ? "خطوات أصغر" : "Smaller steps"}</p>
            <h2>{ar ? "المهام الفرعية" : "Subtasks"}</h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setSubtaskOpen(true)}
          >
            {ar ? "إضافة خطوة" : "Add step"}
          </Button>
        </div>

        {subtaskOpen && (
          <div className="editor-panel mt-4">
            <TaskForm
              subjects={subjects}
              locale={locale}
              parentTaskId={task.id}
              onSaved={refresh}
              onCancel={() => setSubtaskOpen(false)}
            />
          </div>
        )}

        <div className="subtask-list mt-4">
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
            <p className="muted-copy text-sm text-muted">
              {ar
                ? "قسّم المهمة عندما تحتاج إلى بداية أسهل."
                : "Break this down when you need an easier place to start."}
            </p>
          )}
        </div>
      </section>
    </PageShell>
  );
}
