"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
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
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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

  const isCompleted = task.status === "COMPLETED";

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`task-row ${isDragging ? "dragging" : ""} ${isCompleted ? "task-completed" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={toggle}
        className="task-checkbox"
        aria-label={ar ? `تحديد ${task.title}` : `Select ${task.title}`}
      />

      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={ar ? `اسحب لإعادة ترتيب ${task.title}` : `Drag to reorder ${task.title}`}
      >
        <GripVertical className="w-4 h-4 text-muted hover:text-foreground transition-colors" aria-hidden="true" />
      </button>

      <div className="task-main">
        <div className="task-title-line">
          <Link
            href={`/tasks/${task.id}`}
            className={`task-title-link ${isCompleted ? "line-through text-muted" : "text-foreground font-semibold"}`}
          >
            {task.title}
          </Link>
          <span className={`priority priority-${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
        </div>

        <div className="task-meta">
          {task.subject && (
            <span className="course-pill-tag" data-color={task.subject.colorToken}>
              <span className="course-color-dot" data-color={task.subject.colorToken} />
              {task.subject.name}
            </span>
          )}
          {task.dueAt && (
            <time className="flex items-center gap-1 text-xs text-muted">
              <Calendar className="w-3.5 h-3.5" />
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(task.dueAt))}
            </time>
          )}
          {task.estimatedMinutes && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Clock className="w-3.5 h-3.5" />
              {task.estimatedMinutes} {ar ? "د" : "min"}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className="text-xs text-muted px-1.5 py-0.5 rounded bg-surface-sunken">
              {task.subtasks.filter((s) => s.status === "COMPLETED").length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </div>

      <div className="row-actions">
        <button
          onClick={() => move(-1)}
          aria-label={ar ? "تحريك لأعلى" : "Move up"}
          title={ar ? "تحريك لأعلى" : "Move up"}
          className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => move(1)}
          aria-label={ar ? "تحريك لأسفل" : "Move down"}
          title={ar ? "تحريك لأسفل" : "Move down"}
          className="p-1 rounded hover:bg-surface-hover text-muted hover:text-foreground transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        <Button
          variant={isCompleted ? "secondary" : "subtle"}
          size="sm"
          onClick={complete}
          leftIcon={isCompleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        >
          {isCompleted ? (ar ? "إعادة فتح" : "Reopen") : (ar ? "إنجاز" : "Done")}
        </Button>
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
    [filter, ar]
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
        [...current, data.subject].sort((a, b) => a.name.localeCompare(b.name))
      );
      setShowAddCourse(false);
    }
  }

  // Filter tasks by selected course if active
  const filteredTasks = useMemo(() => {
    if (!selectedSubjectId) return tasks;
    return tasks.filter((t) => t.subject?.id === selectedSubjectId);
  }, [tasks, selectedSubjectId]);

  const labels = ar
    ? ["الكل", "اليوم", "هذا الأسبوع", "متأخرة", "مكتملة"]
    : ["All", "Today", "This week", "Overdue", "Completed"];

  return (
    <div className="task-workspace-container">
      {/* 1. Courses Filter Bar */}
      <div className="courses-filter-bar">
        <div className="courses-filter-scroll">
          <button
            type="button"
            onClick={() => setSelectedSubjectId(null)}
            className={`course-filter-chip ${selectedSubjectId === null ? "active" : ""}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{ar ? "كل المواد" : "All Courses"}</span>
            <span className="count-badge">{tasks.length}</span>
          </button>

          {subjects.map((s) => {
            const count = tasks.filter((t) => t.subject?.id === s.id).length;
            const isSelected = selectedSubjectId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubjectId(isSelected ? null : s.id)}
                className={`course-filter-chip ${isSelected ? "active" : ""}`}
                data-color={s.colorToken}
              >
                <span className="course-color-dot" data-color={s.colorToken} />
                <span>{s.name}</span>
                {count > 0 && <span className="count-badge">{count}</span>}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowAddCourse(!showAddCourse)}
            className="course-filter-add-btn"
            title={ar ? "إضافة مقرر جديد" : "Add new course"}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{ar ? "مقرر جديد" : "New Course"}</span>
          </button>
        </div>

        {/* Inline Add Course Popover Form */}
        {showAddCourse && (
          <form action={addSubject} className="inline-add-course-form">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <input
                id="subject-name"
                name="name"
                required
                autoFocus
                className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
                placeholder={ar ? "اسم المادة (مثال: Pharmacology)..." : "Course name (e.g. Pharmacology)..."}
              />
            </div>
            <select
              name="colorToken"
              className="px-2 py-1.5 text-xs rounded-md border border-line bg-surface text-foreground"
            >
              <option value="teal">{ar ? "فيروزي" : "Teal"}</option>
              <option value="coral">{ar ? "مرجاني" : "Coral"}</option>
              <option value="amber">{ar ? "كهرماني" : "Amber"}</option>
              <option value="violet">{ar ? "بنفسجي" : "Violet"}</option>
              <option value="blue">{ar ? "أزرق" : "Blue"}</option>
              <option value="emerald">{ar ? "زمردي" : "Emerald"}</option>
            </select>
            <Button variant="primary" size="sm" type="submit">
              {ar ? "حفظ" : "Save"}
            </Button>
            <button
              type="button"
              onClick={() => setShowAddCourse(false)}
              className="p-1 text-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* 2. Fast Inline Task Capture */}
      <QuickAdd locale={locale} subjects={subjects} onSaved={() => void load()} />

      {/* 3. Task Management Section */}
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

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            {ar ? "نموذج مفصل" : "Detailed Form"}
          </Button>
        </div>

        {selected.length > 0 && (
          <div
            className="bulk-bar"
            role="region"
            aria-label={ar ? "إجراءات جماعية" : "Bulk actions"}
          >
            <span className="font-medium text-sm">
              {selected.length} {ar ? "محددة" : "selected"}
            </span>
            <Button
              variant="subtle"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5" />}
              onClick={() => bulk("COMPLETE")}
            >
              {ar ? "إنجاز" : "Complete"}
            </Button>
            <Button
              variant="subtle"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => bulk("REOPEN")}
            >
              {ar ? "إعادة فتح" : "Reopen"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => bulk("DELETE")}
            >
              {ar ? "حذف" : "Delete"}
            </Button>
          </div>
        )}

        {showForm && (
          <div className="editor-panel p-4 border-b border-line bg-surface-sunken">
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
          <div className="task-state p-8 text-center text-muted" role="status">
            <span className="loader" />
            <p className="mt-2 text-sm">{ar ? "جارٍ تحميل خطتك…" : "Loading tasks…"}</p>
          </div>
        ) : error ? (
          <div className="task-state error-state p-6 text-center" role="alert">
            <p className="text-danger mb-3">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {ar ? "إعادة المحاولة" : "Try again"}
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState
            title={ar ? "لا توجد مهام مطابقة" : "No tasks found"}
            description={
              selectedSubjectId
                ? ar
                  ? "لا توجد مهام مسجلة لهذا المقرر حاليًا."
                  : "No tasks registered under this course yet."
                : ar
                ? "أضف خطوة دراسية جديدة من شريط الإدخال أعلاه."
                : "Type a task in the quick-input bar above to get started."
            }
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
            <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="task-list">
                {filteredTasks.map((task) => (
                  <SortableTask
                    key={task.id}
                    task={task}
                    locale={locale}
                    selected={selected.includes(task.id)}
                    toggle={() =>
                      setSelected((s) =>
                        s.includes(task.id) ? s.filter((id) => id !== task.id) : [...s, task.id]
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
    </div>
  );
}
