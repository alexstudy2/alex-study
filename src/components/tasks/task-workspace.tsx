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
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  X,
  ListTodo,
  PenTool,
  ArrowUpDown,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm } from "./task-form";
import type { Subject, Task } from "./types";

const filters = ["all", "today", "upcoming", "completed"] as const;

function TaskRowItem({
  task,
  locale,
  toggleComplete,
  move,
  onRefresh,
  onDelete,
  pending,
  manageMode,
}: {
  task: Task;
  locale: "en" | "ar";
  toggleComplete: () => void;
  move: (delta: number) => void;
  onRefresh: () => void;
  onDelete: () => void;
  pending: boolean;
  manageMode: boolean;
}) {
  const ar = locale === "ar";
  const [expanded, setExpanded] = useState(false);
  const [subtaskPending, setSubtaskPending] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const isCompleted = task.status === "COMPLETED";
  const doneSubtasks = task.subtasks.filter((s) => s.status === "COMPLETED").length;
  const minutes = task.estimatedMinutes && task.estimatedMinutes > 0 ? task.estimatedMinutes : null;
  const subtasksPanelId = `subtasks-${task.id}`;

  async function toggleSubtask(subtaskId: string, isDone: boolean) {
    if (subtaskPending) return;
    setSubtaskPending(subtaskId);
    const response = await fetch(`/api/tasks/${subtaskId}/${isDone ? "reopen" : "complete"}`, {
      method: "POST",
    }).catch(() => null);
    setSubtaskPending(null);
    if (response?.ok) onRefresh();
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        "--note-color": `var(--${task.subject?.colorToken ?? "amber"})`,
      } as React.CSSProperties}
      className={`notebook-task-row sticky-task-note ${isDragging ? "dragging" : ""} ${isCompleted ? "completed" : ""}`}
      data-priority={task.priority.toLowerCase()}
      data-manage={manageMode ? "on" : "off"}
      aria-busy={pending}
    >
      <div className="task-row-left">
        <button
          type="button"
          className="drag-grip-btn"
          {...attributes}
          {...listeners}
          aria-label={ar ? "إعادة ترتيب" : "Reorder"}
          title={ar ? "اسحب لإعادة الترتيب" : "Drag to reorder"}
        >
          <GripVertical className="w-4 h-4 text-muted hover:text-foreground transition-colors" />
        </button>

        <button
          type="button"
          onClick={toggleComplete}
          disabled={pending}
          className="task-complete-btn"
          aria-label={isCompleted ? (ar ? "إعادة فتح المهمة" : "Reopen task") : (ar ? "إنجاز المهمة" : "Complete task")}
          title={isCompleted ? (ar ? "إعادة فتح المهمة" : "Reopen task") : (ar ? "إنجاز المهمة" : "Complete task")}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-success animate-bounce" />
          ) : (
            <Circle className="w-5 h-5 text-muted hover:text-primary transition-colors" />
          )}
        </button>
      </div>

      <div className="task-row-body">
        <div className="task-row-title-bar">
          <Link
            href={`/tasks/${task.id}`}
            className={`task-row-title ${isCompleted ? "line-through text-muted" : "text-foreground"}`}
          >
            {task.title}
          </Link>

          {/* Plain inline `2/5` rather than a fourth pill: it belongs to the title, not to the
              metadata row, and it was the one badge in that row that was actually a control. */}
          {task.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              disabled={pending}
              className="task-subtasks-toggle"
              aria-expanded={expanded}
              aria-controls={subtasksPanelId}
              aria-label={ar ? "المهام الفرعية" : "Subtasks"}
            >
              <span className="font-mono font-bold">
                {doneSubtasks}/{task.subtasks.length}
              </span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <span className={`task-priority-pill priority-${task.priority.toLowerCase()}`}>
            {task.priority === "LOW"
              ? ar ? "منخفضة" : "Low"
              : task.priority === "MEDIUM"
              ? ar ? "متوسطة" : "Medium"
              : task.priority === "HIGH"
              ? ar ? "عالية" : "High"
              : ar ? "عاجلة" : "Urgent"}
          </span>
        </div>

        <div className="task-row-badges">
          {task.subject && (
            <span className="task-subject-tag" data-color={task.subject.colorToken}>
              <span className="subject-dot" data-color={task.subject.colorToken} />
              {task.subject.name}
            </span>
          )}

          {/* Due date and estimate are one fact -- when, and for how long -- so they share a
              single pill instead of two. `<time>` only wraps the date part; the estimate is
              a duration, not a datetime, and mislabelling it would be worse than no markup. */}
          {(task.dueAt || minutes) && (
            <span className="task-meta-pill">
              {task.dueAt ? (
                <Calendar className="w-3 h-3 text-muted" />
              ) : (
                <Clock className="w-3 h-3 text-muted" />
              )}
              {task.dueAt && (
                <time dateTime={new Date(task.dueAt).toISOString()}>
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(task.dueAt))}
                </time>
              )}
              {task.dueAt && minutes && <span aria-hidden="true">·</span>}
              {minutes && (
                <span className="font-mono font-bold">
                  {minutes}
                  {ar ? "د" : "m"}
                </span>
              )}
            </span>
          )}
        </div>

        {expanded && task.subtasks.length > 0 && (
          <div className="notebook-subtasks-box" id={subtasksPanelId}>
            {task.subtasks.map((subtask) => {
              const subtaskCompleted = subtask.status === "COMPLETED";
              return (
                <label key={subtask.id} className="subtask-item">
                  <input
                    type="checkbox"
                    checked={subtaskCompleted}
                    onChange={() => toggleSubtask(subtask.id, subtaskCompleted)}
                    disabled={subtaskPending === subtask.id}
                    className="task-checkbox"
                  />
                  <span className={`text-xs font-semibold ${subtaskCompleted ? "line-through text-muted" : "text-foreground"}`}>
                    {subtask.title}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="task-row-actions">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={pending}
          className="task-action-icon-btn"
          aria-label={ar ? "تحريك لأعلى" : "Move up"}
          title={ar ? "تحريك لأعلى" : "Move up"}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={pending}
          className="task-action-icon-btn"
          aria-label={ar ? "تحريك لأسفل" : "Move down"}
          title={ar ? "تحريك لأسفل" : "Move down"}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="task-action-icon-btn delete-btn"
          aria-label={ar ? "حذف المهمة" : "Delete task"}
          title={ar ? "حذف المهمة" : "Delete task"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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
  const [quickTitle, setQuickTitle] = useState("");
  const [quickSubjectId, setQuickSubjectId] = useState("");
  const [quickPriority, setQuickPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  /* Both default to closed and are only surfaced below 768px -- above it the controls they
     gate are always on screen, so the toggles themselves are display:none there. */
  const [manageMode, setManageMode] = useState(false);
  const [quickOptionsOpen, setQuickOptionsOpen] = useState(false);

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
      const apiFilter = filter === "upcoming" ? "week" : filter;
      const response = await fetch(`/api/tasks?filter=${apiFilter}`);
      const data = await response.json();
      setLoading(false);
      if (!response.ok) {
        setError(ar ? "تعذر تحميل المهام." : "Could not load tasks.");
        return;
      }
      setTasks(data.tasks);
    },
    [filter, ar]
  );

  useEffect(() => {
    queueMicrotask(() => void load(false));
  }, [load]);

  async function persistOrder(next: Task[]) {
    setTasks(next);
    const reorderedIds = new Set(next.map((task) => task.id));
    let reorderedIndex = 0;
    const fullOrder = tasks.map((task) =>
      reorderedIds.has(task.id) ? next[reorderedIndex++] : task,
    );
    const response = await fetch("/api/tasks/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskIds: fullOrder.map((t) => t.id) }),
    });
    if (!response.ok) {
      setError(ar ? "تعذر حفظ الترتيب." : "Could not save order.");
      void load();
    }
  }

  function dragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredTasks.findIndex((t) => t.id === active.id);
    const newIndex = filteredTasks.findIndex((t) => t.id === over.id);
    void persistOrder(arrayMove(filteredTasks, oldIndex, newIndex));
  }

  function move(id: string, delta: number) {
    const index = filteredTasks.findIndex((t) => t.id === id);
    const target = index + delta;
    if (target < 0 || target >= filteredTasks.length) return;
    void persistOrder(arrayMove(filteredTasks, index, target));
  }

  async function toggleStatus(task: Task) {
    if (pendingTaskId) return;
    setPendingTaskId(task.id);
    const response = await fetch(`/api/tasks/${task.id}/${task.status === "COMPLETED" ? "reopen" : "complete"}`, {
      method: "POST",
    }).catch(() => null);
    setPendingTaskId(null);
    if (!response?.ok) {
      setError(ar ? "تعذر تحديث حالة المهمة." : "Could not update the task status.");
      return;
    }
    void load();
  }

  async function deleteTask(taskId: string) {
    if (!confirm(ar ? "حذف هذه المهمة؟" : "Delete this task?")) return;
    if (pendingTaskId) return;
    setPendingTaskId(taskId);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" }).catch(() => null);
    setPendingTaskId(null);
    if (!response?.ok) {
      setError(ar ? "تعذر حذف المهمة." : "Could not delete the task.");
      return;
    }
    void load();
  }

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim() || isSubmittingQuick) return;

    setIsSubmittingQuick(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: quickTitle.trim(),
          subjectId: quickSubjectId || selectedSubjectId || null,
          priority: quickPriority,
          status: "TODO",
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        setQuickTitle("");
        setFilter("all");
        setTasks((current) => [payload.task, ...current.filter((task) => task.id !== payload.task.id)]);
      } else {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ? String(payload.error) : ar ? "تعذر حفظ المهمة." : "Could not save the task.");
      }
    } catch {
      setError(ar ? "تعذر الاتصال بالخادم." : "Could not reach the server.");
    } finally {
      setIsSubmittingQuick(false);
    }
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
      setQuickSubjectId(data.subject.id);
      setSelectedSubjectId(data.subject.id);
      setError("");
    } else {
      const payload = await response.json().catch(() => null);
      setError(
        payload?.error === "subject_exists"
          ? ar ? "هذه المادة موجودة بالفعل." : "This course already exists."
          : ar ? "تعذر حفظ المادة. راجع الاسم واللون." : "Could not save the course. Check its name and color.",
      );
    }
  }

  const filteredTasks = selectedSubjectId
    ? tasks.filter((task) => task.subject?.id === selectedSubjectId)
    : tasks;
  const completedCount = tasks.filter((task) => task.status === "COMPLETED").length;

  const labels = ar
      ? { all: "الكل", today: "اليوم", upcoming: "القادمة", completed: "المكتملة" }
      : { all: "All", today: "Today", upcoming: "Upcoming", completed: "Completed" };

  return (
    <div className="notebook-workspace" dir={ar ? "rtl" : "ltr"}>
      {/* 1. Header Bar: Title, Doodle Tabs, Actions */}
      <header className="notebook-top-header">
        <div className="header-branding">
          <div className="header-icon-box">
            <ListTodo className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <h1 className="header-title">
              {ar ? "دفتر المهام الدراسية" : "Study Task Planner"}
            </h1>
            <p className="header-subtitle">
              {ar
                ? `${filteredTasks.length} مهام في هذا العرض`
                : `${filteredTasks.length} tasks in this view`}
            </p>
          </div>
        </div>

        {/* Doodle Segmented Filter Tabs */}
        <div className="notebook-filter-tabs" role="tablist" aria-label={ar ? "تصفية المهام" : "Task filters"}>
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`notebook-tab ${filter === f ? "active" : ""}`}
            >
              {labels[f]}
            </button>
          ))}
        </div>

        <div className="header-actions">
          {/* Mobile only. Touch drag-and-drop is unreliable, so the per-card move/delete
              buttons have to stay reachable -- but one toggle for the whole list beats three
              permanently-visible buttons on every card. */}
          <button
            type="button"
            onClick={() => setManageMode(!manageMode)}
            className={`notebook-manage-toggle ${manageMode ? "active" : ""}`}
            aria-pressed={manageMode}
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>{ar ? "ترتيب" : "Arrange"}</span>
          </button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowForm(!showForm)}
          >
            {ar ? "نموذج مفصل" : "Detailed Form"}
          </Button>
        </div>
      </header>

      {/* 2. Subjects Divider Ribbon */}
      <nav className="subjects-ribbon" aria-label={ar ? "تصفية المواد" : "Course filter"}>
        <div className="subjects-scroll">
          <button
            type="button"
            onClick={() => setSelectedSubjectId(null)}
            className={`subject-chip ${selectedSubjectId === null ? "active" : ""}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{ar ? "كل المقررات" : "All Courses"}</span>
            <span className="chip-count">{tasks.length}</span>
          </button>

          {subjects.map((s) => {
            const count = tasks.filter((t) => t.subject?.id === s.id).length;
            const isSelected = selectedSubjectId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSubjectId(isSelected ? null : s.id)}
                className={`subject-chip ${isSelected ? "active" : ""}`}
                data-color={s.colorToken}
              >
                <span className="subject-color-indicator" data-color={s.colorToken} />
                <span>{s.name}</span>
                {count > 0 && <span className="chip-count">{count}</span>}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowAddCourse(!showAddCourse)}
            className="subject-add-chip"
            title={ar ? "إضافة مادة جديدة" : "Add new course"}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{ar ? "مقرر جديد" : "New Course"}</span>
          </button>
        </div>

        {showAddCourse && (
          <form action={addSubject} className="inline-new-course-popup">
            <input
              id="subject-name"
              name="name"
              required
              autoFocus
              className="course-name-input"
              placeholder={ar ? "اسم المادة..." : "Course name..."}
            />
            <select name="colorToken" className="course-color-select">
              <option value="teal">{ar ? "فيروزي" : "Teal"}</option>
              <option value="coral">{ar ? "مرجاني" : "Coral"}</option>
              <option value="amber">{ar ? "كهرماني" : "Amber"}</option>
              <option value="violet">{ar ? "بنفسجي" : "Violet"}</option>
              <option value="sky">{ar ? "أزرق سماوي" : "Sky"}</option>
              <option value="rose">{ar ? "وردي" : "Rose"}</option>
              <option value="slate">{ar ? "رمادي" : "Slate"}</option>
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
      </nav>

      {/* 3. Detailed Form Drawer if opened */}
      {showForm && (
        <div className="detailed-form-drawer">
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

      {/* 4. The Master Study Notebook Card */}
      <main className="master-notebook-card">
        {/* Integrated Quick-Add Row at the top of the notebook */}
        <form
          onSubmit={handleQuickAdd}
          className="notebook-quick-add-line"
          data-options={quickOptionsOpen ? "on" : "off"}
        >
          <div className="quick-add-left-icon">
            <PenTool className="w-4 h-4 text-muted" />
          </div>

          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={
              ar
                ? "اكتب مهمتك الدراسية هنا... واضغط Enter"
                : "Write your study task here... and press Enter"
            }
            className="quick-add-input"
            disabled={isSubmittingQuick}
          />

          {/* Mobile only. Two <select>s competing with the input every time is the noise the
              redesign is removing; the primary action is type-a-title-and-submit. */}
          <button
            type="button"
            onClick={() => setQuickOptionsOpen(!quickOptionsOpen)}
            className={`quick-add-options-toggle ${quickOptionsOpen ? "active" : ""}`}
            aria-expanded={quickOptionsOpen}
            aria-label={ar ? "خيارات المهمة" : "Task options"}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Outside .quick-add-options: that wrapper is what collapses on mobile, and submit
              has to stay on screen with the input. */}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="quick-add-submit"
            disabled={!quickTitle.trim() || isSubmittingQuick}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {ar ? "إضافة" : "Add"}
          </Button>

          <div className="quick-add-options">
            <select
              value={quickSubjectId}
              onChange={(e) => setQuickSubjectId(e.target.value)}
              className="quick-add-select"
              aria-label={ar ? "المادة" : "Subject"}
            >
              <option value="">{ar ? "بدون مقرر" : "No course"}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={quickPriority}
              onChange={(e) => setQuickPriority(e.target.value as typeof quickPriority)}
              className="quick-add-select"
              aria-label={ar ? "الأولوية" : "Priority"}
            >
              <option value="LOW">{ar ? "أولوية منخفضة" : "Low"}</option>
              <option value="MEDIUM">{ar ? "أولوية متوسطة" : "Medium"}</option>
              <option value="HIGH">{ar ? "أولوية عالية" : "High"}</option>
              <option value="URGENT">{ar ? "أولوية عاجلة" : "Urgent"}</option>
            </select>
          </div>
        </form>

        {/* Notebook Tasks List Surface */}
        <div className="notebook-tasks-surface">
          {loading ? (
            <div className="notebook-state-box">
              <span className="loader" />
              <p className="state-text">{ar ? "جارٍ تحميل مهامك…" : "Loading tasks…"}</p>
            </div>
          ) : error ? (
            <div className="notebook-state-box error">
              <p className="text-danger font-bold mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {ar ? "إعادة المحاولة" : "Try again"}
              </Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="notebook-empty-view">
              <div className="empty-icon-circle">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="empty-title">
                {ar ? "دفترك خالٍ تمامًا في هذا التبويب" : "Your notebook is all clear"}
              </h3>
              <p className="empty-description">
                {selectedSubjectId
                  ? ar
                    ? "لا توجد مهام مسجلة لهذا المقرر حاليًا."
                    : "No tasks registered under this course."
                  : ar
                  ? "ابدأ بكتابة مهمتك الأولى في السطر بالأعلى للبدء."
                  : "Type your first task in the line above to get started."}
              </p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}>
              <SortableContext items={filteredTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
                <div className="notebook-task-list">
                  {filteredTasks.map((task) => (
                    <TaskRowItem
                      key={task.id}
                      task={task}
                      locale={locale}
                      toggleComplete={() => toggleStatus(task)}
                      move={(delta) => move(task.id, delta)}
                      onRefresh={() => void load()}
                      onDelete={() => void deleteTask(task.id)}
                      pending={pendingTaskId === task.id}
                      manageMode={manageMode}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Notebook Footer Ribbon */}
        {tasks.length > 0 && (
          <footer className="notebook-footer-bar">
            <div className="flex items-center gap-2 text-xs font-bold text-muted">
              <span>
                {ar
                  ? `تم إنجاز ${completedCount} من ${tasks.length} مهام`
                  : `Completed ${completedCount} of ${tasks.length} tasks`}
              </span>
            </div>
            <div className="notebook-mini-progress">
              <span style={{ width: `${Math.round((completedCount / tasks.length) * 100)}%` }} />
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
