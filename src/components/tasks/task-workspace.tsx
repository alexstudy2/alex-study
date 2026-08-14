"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QuickAdd } from "./quick-add";
import { TaskForm } from "./task-form";
import type { Subject, Task } from "./types";

const filters = ["all", "today", "week", "overdue", "completed"] as const;
function SortableTask({
  task,
  locale,
  selected,
  toggle,
  complete,
  move,
}: {
  task: Task;
  locale: "en" | "ar";
  selected: boolean;
  toggle: () => void;
  complete: () => void;
  move: (delta: number) => void;
}) {
  const ar = locale === "ar";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-row ${isDragging ? "dragging" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={toggle}
        aria-label={ar ? `تحديد ${task.title}` : `Select ${task.title}`}
      />
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={ar ? `اسحب لإعادة ترتيب ${task.title}` : `Drag to reorder ${task.title}`}
      >
        ⠿
      </button>
      <div className="task-main">
        <div className="task-title-line">
          <Link href={`/tasks/${task.id}`}>{task.title}</Link>
          <span className={`priority priority-${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        </div>
        <div className="task-meta">
          {task.subject && <span>{task.subject.name}</span>}
          {task.dueAt && (
            <time>
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(task.dueAt))}
            </time>
          )}
          {task.estimatedMinutes && (
            <span>
              {task.estimatedMinutes} {ar ? "د" : "min"}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span>
              {task.subtasks.filter((s) => s.status === "COMPLETED").length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>
      <div className="row-actions">
        <button onClick={() => move(-1)} aria-label={ar ? "تحريك لأعلى" : "Move up"}>
          ↑
        </button>
        <button onClick={() => move(1)} aria-label={ar ? "تحريك لأسفل" : "Move down"}>
          ↓
        </button>
        <button className="compact-action" onClick={complete}>
          {task.status === "COMPLETED" ? (ar ? "إعادة فتح" : "Reopen") : ar ? "إنجاز" : "Done"}
        </button>
      </div>
    </article>
  );
}

export function TaskWorkspace({
  locale,
  initialSubjects,
}: {
  locale: "en" | "ar";
  initialSubjects: Subject[];
}) {
  const ar = locale === "ar";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
        setError("");
      }
      const response = await fetch(`/api/tasks?filter=${filter}`);
      const data = await response.json();
      setLoading(false);
      if (!response.ok) {
        setError(ar ? "تعذر تحميل المهام." : "Could not load tasks.");
        return;
      }
      setTasks(data.tasks);
      setSelected([]);
    },
    [filter, ar],
  );
  useEffect(() => {
    queueMicrotask(() => void load(false));
  }, [load]);
  async function persistOrder(next: Task[]) {
    setTasks(next);
    const response = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskIds: next.map((t) => t.id) }),
    });
    if (!response.ok) {
      setError(ar ? "تعذر حفظ الترتيب." : "Could not save order.");
      void load();
    }
  }
  function dragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    void persistOrder(arrayMove(tasks, oldIndex, newIndex));
  }
  function move(id: string, delta: number) {
    const index = tasks.findIndex((t) => t.id === id);
    const target = index + delta;
    if (target < 0 || target >= tasks.length) return;
    void persistOrder(arrayMove(tasks, index, target));
  }
  async function toggleStatus(task: Task) {
    await fetch(`/api/tasks/${task.id}/${task.status === "COMPLETED" ? "reopen" : "complete"}`, {
      method: "POST",
    });
    void load();
  }
  async function bulk(action: "COMPLETE" | "REOPEN" | "DELETE") {
    if (!selected.length) return;
    await fetch("/api/tasks/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskIds: selected, action }),
    });
    void load();
  }
  async function addSubject(formData: FormData) {
    const response = await fetch("/api/subjects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: formData.get("name"), colorToken: formData.get("colorToken") }),
    });
    if (response.ok) {
      const data = await response.json();
      setSubjects((current) =>
        [...current, data.subject].sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }
  const labels = ar
    ? ["الكل", "اليوم", "هذا الأسبوع", "متأخرة", "مكتملة"]
    : ["All", "Today", "This week", "Overdue", "Completed"];
  return (
    <>
      <QuickAdd locale={locale} subjects={subjects} onSaved={() => void load()} />
      <section className="task-board">
        <div className="task-toolbar">
          <div
            role="tablist"
            aria-label={ar ? "تصفية المهام" : "Task filters"}
            className="filter-list"
          >
            {filters.map((item, index) => (
              <button
                key={item}
                role="tab"
                aria-selected={filter === item}
                onClick={() => setFilter(item)}
              >
                {labels[index]}
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={() => setShowForm(true)}>
            + {ar ? "مهمة جديدة" : "New task"}
          </button>
        </div>
        {selected.length > 0 && (
          <div
            className="bulk-bar"
            role="region"
            aria-label={ar ? "إجراءات جماعية" : "Bulk actions"}
          >
            <span>
              {selected.length} {ar ? "محددة" : "selected"}
            </span>
            <button onClick={() => bulk("COMPLETE")}>{ar ? "إنجاز" : "Complete"}</button>
            <button onClick={() => bulk("REOPEN")}>{ar ? "إعادة فتح" : "Reopen"}</button>
            <button onClick={() => bulk("DELETE")}>{ar ? "حذف" : "Delete"}</button>
          </div>
        )}
        {showForm && (
          <div className="editor-panel">
            <TaskForm
              subjects={subjects}
              locale={locale}
              onSaved={() => {
                setShowForm(false);
                void load();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}
        {loading ? (
          <div className="task-state" role="status">
            <span className="loader" />
            {ar ? "جارٍ تحميل خطتك…" : "Loading your plan…"}
          </div>
        ) : error ? (
          <div className="task-state error-state" role="alert">
            <p>{error}</p>
            <button className="secondary-button" onClick={() => void load()}>
              {ar ? "إعادة المحاولة" : "Try again"}
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="task-state empty-state">
            <p className="eyebrow">{ar ? "مساحة واضحة" : "Clear space"}</p>
            <h2>{ar ? "لا توجد مهام في هذا العرض" : "No tasks in this view"}</h2>
            <p>
              {ar ? "أضف خطوة صغيرة وواضحة لتبدأ." : "Add one clear, manageable step to begin."}
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="task-list">
                {tasks.map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    locale={locale}
                    selected={selected.includes(task.id)}
                    toggle={() =>
                      setSelected((s) =>
                        s.includes(task.id) ? s.filter((id) => id !== task.id) : [...s, task.id],
                      )
                    }
                    complete={() => toggleStatus(task)}
                    move={(delta) => move(task.id, delta)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>
      <aside className="subject-strip">
        <div>
          <p className="eyebrow">{ar ? "المواد" : "Subjects"}</p>
          <h2>{ar ? "نظّم حسب المقرر" : "Organize by course"}</h2>
        </div>
        <div className="subject-chips">
          {subjects.map((s) => (
            <span key={s.id} data-color={s.colorToken}>
              {s.name}
            </span>
          ))}
        </div>
        <form action={addSubject} className="subject-form">
          <label className="sr-only" htmlFor="subject-name">
            {ar ? "اسم المادة" : "Subject name"}
          </label>
          <input
            id="subject-name"
            name="name"
            required
            placeholder={ar ? "إضافة مادة" : "Add a subject"}
          />
          <select name="colorToken" aria-label={ar ? "لون المادة" : "Subject color"}>
            <option value="teal">Teal</option>
            <option value="coral">Coral</option>
            <option value="amber">Amber</option>
            <option value="violet">Violet</option>
          </select>
          <button className="secondary-button">{ar ? "إضافة" : "Add"}</button>
        </form>
      </aside>
    </>
  );
}
