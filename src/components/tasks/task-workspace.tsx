"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
  ClipboardList,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoodleLoader } from "@/components/ui/doodle-loader";
import { EcgTrace, MedicalGlyph } from "@/components/ui/medical-doodles";
import { dayBounds } from "@/lib/tasks/dates";
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
  dayStart,
}: {
  task: Task;
  locale: "en" | "ar";
  toggleComplete: () => void;
  move: (delta: number) => void;
  onRefresh: () => void;
  onDelete: () => void;
  pending: boolean;
  manageMode: boolean;
  /** Midnight tonight in the app's timezone -- see the `vitals` memo for why it is passed in. */
  dayStart: Date;
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
  const isOverdue = !isCompleted && Boolean(task.dueAt) && new Date(task.dueAt!) < dayStart;

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
        /* `--subject-*`, not `--${colorToken}`. The bare form named tokens that do not exist,
           which made --note-color guaranteed-invalid and took the whole color-mix() down with
           it -- every note rendered with no paper at all. See tokens.css. */
        "--note-color": `var(--subject-${task.subject?.colorToken ?? "teal"})`,
      } as React.CSSProperties}
      className={`notebook-task-row sticky-task-note ${isDragging ? "dragging" : ""} ${isCompleted ? "completed" : ""}`}
      data-priority={task.priority.toLowerCase()}
      data-manage={manageMode ? "on" : "off"}
      data-overdue={isOverdue ? "yes" : "no"}
      aria-busy={pending}
    >
      {/* Pure texture, behind everything, and the only reason the notes read as chart paper
          rather than as coloured rectangles. Seeded on the course, not the task, so every card in
          a course carries the same instrument and the board reads as grouped even when it is
          sorted by hand -- loose tasks fall back to their own id, which still gives them a stable
          glyph across reloads. */}
      <MedicalGlyph seed={task.subject?.id ?? task.id} className="task-note-watermark" />

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

        {/* The count in the toggle above says 2/5; the bar says how far along that is without
            anyone having to do the division. aria-hidden because it is the same fact, and the
            toggle already announces it. */}
        {task.subtasks.length > 0 && (
          <span className="task-subtask-bar" aria-hidden="true">
            <span
              style={{ width: `${Math.round((doneSubtasks / task.subtasks.length) * 100)}%` }}
            />
          </span>
        )}

        <div className="task-row-badges">
          {task.subject && (
            <span className="task-subject-tag" data-color={task.subject.colorToken}>
              <span className="subject-dot" data-color={task.subject.colorToken} />
              {task.subject.name}
            </span>
          )}

          {/* Plain words, and a chip rather than only a colour: a past due date is already in
              the pill beside it, but "12 Aug" only reads as late if you happen to know today's
              date. */}
          {isOverdue && (
            <span className="task-overdue-chip">
              <AlertTriangle className="w-3 h-3" />
              {ar ? "متأخرة" : "Overdue"}
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
  /* The empty state's primary action puts the caret in the quick-add line rather than opening
     the detailed form: on an empty board the next thing anyone wants is to type one title. */
  const quickInputRef = useRef<HTMLInputElement>(null);

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

  /**
   * The four readouts in the vitals strip, plus the midnight boundary each card needs to know
   * whether it is late.
   *
   * The day comes from getTaskDateWindow rather than a local startOfDay(): that helper pins the
   * boundary to the app's timezone, which is the same one every server-rendered "today" count
   * on the dashboard already uses. Computed from a plain new Date() here, a student on a
   * different device clock would see the two pages disagree about which tasks are overdue.
   *
   * Keyed on `tasks` so it also re-derives on every refresh -- which is what keeps the boundary
   * honest across a session left open past midnight.
   */
  const vitals = useMemo(() => {
    const { start: dayStart, end: dayEnd } = dayBounds();

    let open = 0;
    let dueToday = 0;
    let overdue = 0;
    let done = 0;
    for (const task of tasks) {
      if (task.status === "COMPLETED") {
        done += 1;
        continue;
      }
      open += 1;
      if (!task.dueAt) continue;
      const due = new Date(task.dueAt);
      if (due < dayStart) overdue += 1;
      else if (due <= dayEnd) dueToday += 1;
    }

    return {
      open,
      dueToday,
      overdue,
      done,
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      dayStart,
    };
  }, [tasks]);

  const labels = ar
      ? { all: "الكل", today: "اليوم", upcoming: "القادمة", completed: "المكتملة" }
      : { all: "All", today: "Today", upcoming: "Upcoming", completed: "Completed" };

  /* Which nothing is on screen matters: an empty "Completed" tab is progress not yet made, an
     empty course is a filter, and an empty board is a blank page. Same scene, different words,
     and each one names the thing that would fill it. */
  const emptyCopy = selectedSubjectId
    ? {
        title: ar ? "لا مهام في هذا المقرر" : "Nothing in this course",
        body: ar
          ? "لم تُسجَّل أي مهمة تحت هذا المقرر بعد. أضف واحدة، أو اعرض كل المقررات."
          : "No task has been filed under this course yet. Add one, or show every course.",
      }
    : filter === "completed"
    ? {
        title: ar ? "لا شيء مكتمل بعد" : "Nothing finished yet",
        body: ar
          ? "كل مهمة تُنجزها ستُحفظ هنا. ابدأ بواحدة صغيرة."
          : "Every task you finish is filed here. Start with a small one.",
      }
    : filter === "today"
    ? {
        title: ar ? "لا مهام مستحقة اليوم" : "Nothing due today",
        body: ar
          ? "يومك خالٍ. استخدمه في مراجعة مبكرة، أو أضف مهمة لليوم."
          : "Your day is clear. Use it to revise early, or add something for today.",
      }
    : filter === "upcoming"
    ? {
        title: ar ? "لا شيء في الأسبوع القادم" : "Nothing this week",
        body: ar
          ? "لا مواعيد قادمة خلال الأسبوع. خطِّط مبكرًا وستشكر نفسك لاحقًا."
          : "No due dates in the week ahead. Plan early and thank yourself later.",
      }
    : {
        title: ar ? "لوحتك فارغة" : "Your board is empty",
        body: ar
          ? "اكتب أول مهمة في السطر بالأعلى — اسم قصير يكفي، وتفاصيلها لاحقًا."
          : "Write your first task in the line above — a short name is enough, details later.",
      };

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

      {/* 2. Vitals: the whole board in four numbers, above the filters that would hide them.
             Only once there is something to count -- four zeroes and a flat trace is a worse
             empty state than the one further down. */}
      {tasks.length > 0 && (
        <section className="task-vitals-strip" aria-label={ar ? "ملخص المهام" : "Task summary"}>
          <dl className="task-vitals">
            <div className="task-vital" data-tone="open">
              <dt>{ar ? "مفتوحة" : "Open"}</dt>
              <dd>{vitals.open}</dd>
            </div>
            <div className="task-vital" data-tone="today">
              <dt>{ar ? "اليوم" : "Today"}</dt>
              <dd>{vitals.dueToday}</dd>
            </div>
            <div className="task-vital" data-tone="overdue" data-zero={vitals.overdue === 0 ? "yes" : "no"}>
              <dt>{ar ? "متأخرة" : "Overdue"}</dt>
              <dd>{vitals.overdue}</dd>
            </div>
            <div className="task-vital" data-tone="done">
              <dt>{ar ? "مُنجز" : "Done"}</dt>
              {/* dir=ltr on the value only: "٧٥%" belongs in the reading order, but a number
                  followed by a percent sign is not mirrored in Arabic typography. */}
              <dd dir="ltr">{vitals.percent}%</dd>
            </div>
          </dl>
          <EcgTrace className="task-vitals-ecg" />
        </section>
      )}

      {/* 3. Subjects Divider Ribbon */}
      <nav className="subjects-ribbon" aria-label={ar ? "تصفية المواد" : "Course filter"}>
        {/* Mobile only (.notebook-zone-label is display:none above the breakpoint). This page can
            create exactly two things, and on a phone its zones arrive stacked with nothing naming
            any of them: four numbers, a row of chips, a text field. The caption is what makes the
            ribbon read as "courses live here" before the eye reaches the button at its foot. */}
        <span className="notebook-zone-label" aria-hidden="true">
          <BookOpen className="w-3.5 h-3.5" />
          {ar ? "مقرراتك" : "Your courses"}
        </span>

        <div className="subjects-ribbon-row">
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
          </div>

          {/* Outside .subjects-scroll on purpose, and the single biggest reason nobody could find
              where a course gets added: as the last item of a horizontal scroller it was already
              off-screen on a phone by the third course, so the only visible "add" on the page was
              the one in the header -- which makes tasks, not courses. */}
          <button
            type="button"
            onClick={() => setShowAddCourse(!showAddCourse)}
            className="subject-add-chip"
            aria-expanded={showAddCourse}
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

      {/* 4. Detailed Form Drawer if opened */}
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

      {/* 5. The Master Study Notebook Card */}
      <main className="master-notebook-card">
        {/* Integrated Quick-Add Row at the top of the notebook */}
        <form
          onSubmit={handleQuickAdd}
          className="notebook-quick-add-line"
          data-options={quickOptionsOpen ? "on" : "off"}
        >
          {/* The ribbon's caption, for the other half of the pair. On a phone this row is an empty
              box under four numbers, and its placeholder is the only thing that says what it makes
              -- which is invisible the moment anyone starts typing. aria-hidden because the input
              carries its own aria-label, so hiding this above the breakpoint costs it nothing. */}
          <span className="notebook-zone-label" aria-hidden="true">
            <PenTool className="w-3.5 h-3.5" />
            {ar ? "مهمة جديدة" : "New task"}
          </span>

          <div className="quick-add-left-icon">
            <PenTool className="w-4 h-4 text-muted" />
          </div>

          <input
            type="text"
            ref={quickInputRef}
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            aria-label={ar ? "عنوان المهمة الجديدة" : "New task title"}
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
            <DoodleLoader
              className="notebook-state-box"
              message={ar ? "جارٍ تحميل مهامك…" : "Loading tasks…"}
            />
          ) : error ? (
            <div className="notebook-state-box error">
              <p className="text-danger font-bold mb-3">{error}</p>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {ar ? "إعادة المحاولة" : "Try again"}
              </Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="notebook-empty-view">
              {/* A blank chart on a clipboard with a flatline across it -- the one drawing that
                  says "nothing recorded" without a word, and the beat at the end says it is
                  waiting rather than broken. */}
              <div className="empty-scene" aria-hidden="true">
                <ClipboardList className="empty-scene-glyph" />
                <EcgTrace className="empty-scene-ecg" variant="flatline" />
              </div>
              <h3 className="empty-title">{emptyCopy.title}</h3>
              <p className="empty-description">{emptyCopy.body}</p>
              <div className="empty-actions">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => quickInputRef.current?.focus()}
                >
                  {ar ? "أضف مهمة" : "Add a task"}
                </Button>
                {selectedSubjectId ? (
                  <Button variant="secondary" size="sm" onClick={() => setSelectedSubjectId(null)}>
                    {ar ? "اعرض كل المقررات" : "Show all courses"}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    href="/focus"
                    leftIcon={<Timer className="w-4 h-4" />}
                  >
                    {ar ? "ابدأ جلسة تركيز" : "Start a focus session"}
                  </Button>
                )}
              </div>
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
                      dayStart={vitals.dayStart}
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
                  ? `تم إنجاز ${vitals.done} من ${tasks.length} مهام`
                  : `Completed ${vitals.done} of ${tasks.length} tasks`}
              </span>
            </div>
            <div className="notebook-mini-progress">
              <span style={{ width: `${vitals.percent}%` }} />
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
