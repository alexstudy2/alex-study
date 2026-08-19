"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarRange, ExternalLink, LayoutGrid, List, Share2 } from "lucide-react";
import { planColorToken, safeColorToken } from "@/lib/plan-forum/colors";
import { EXAM_ITEM_KINDS, type ExamItemKind } from "@/lib/exam-plans/topics";
import { ExamPlanBoard, type BoardItem } from "./exam-plan-board";
import { examPlanErrorMessage, examPlanOfflineMessage } from "./exam-plan-errors";
import type { ExamPlan, SubjectOption } from "./types";

type DraftItem = {
  key: string;
  id: string | null;
  title: string;
  notes: string;
  subjectId: string;
  plannedDate: string;
  estimatedMinutes: number;
  kind: ExamItemKind;
  accepted: boolean;
  rejected: boolean;
  createdTask: { id: string; title: string; status: string } | null;
};

const KIND_LABEL: Record<ExamItemKind, { en: string; ar: string }> = {
  STUDY: { en: "Study", ar: "دراسة" },
  QUESTIONS: { en: "Questions", ar: "أسئلة" },
  REVIEW: { en: "Review", ar: "مراجعة" },
};

function cairoDateInput(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function draftItems(plan: ExamPlan): DraftItem[] {
  return plan.items.map((item) => ({
    key: item.id,
    id: item.id,
    title: item.title,
    notes: item.notes ?? "",
    subjectId: item.subject?.id ?? "",
    plannedDate: cairoDateInput(item.plannedDate),
    estimatedMinutes: item.estimatedMinutes,
    kind: item.kind,
    accepted: item.accepted,
    rejected: Boolean(item.rejectedAt),
    createdTask: item.createdTask,
  }));
}

export function ExamPlanEditor({
  locale,
  initialPlan,
  subjects,
}: {
  locale: "en" | "ar";
  initialPlan: ExamPlan;
  subjects: SubjectOption[];
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [plan, setPlan] = useState(initialPlan);
  const [title, setTitle] = useState(initialPlan.title);
  const [overview, setOverview] = useState(initialPlan.overview ?? "");
  const [examDate, setExamDate] = useState(cairoDateInput(initialPlan.examAt));
  const [items, setItems] = useState(() => draftItems(initialPlan));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [studyPlanId, setStudyPlanId] = useState(initialPlan.studyPlanId);
  const locked =
    Boolean(plan.rejectedAt) || plan.status === "ACCEPTED" || plan.status === "REJECTED";
  const hasAcceptedItems = items.some((item) => item.accepted);
  const acceptedCount = items.filter((item) => item.accepted).length;
  const selectedCount = selectedIds.length;
  const selectableIds = useMemo(
    () => items.flatMap((item) => (item.id && !item.accepted && !item.rejected ? [item.id] : [])),
    [items],
  );
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  );
  /*
   * Board rows are derived from the same `items` state the list edits, so switching tabs never loses
   * an edit or a selection. The colour is resolved the way `publishExamPlanToForum` resolves it --
   * the subject's own token when it has one, else the label hash -- so a note is the shade it will
   * be on the forum, not a placeholder that changes on publish.
   */
  const boardItems = useMemo<BoardItem[]>(
    () =>
      items
        .filter((item) => !item.rejected)
        .map((item) => {
          const subject = item.subjectId ? subjectById.get(item.subjectId) : undefined;
          const label = subject?.name ?? plan.title;
          return {
            key: item.key,
            id: item.id,
            title: item.title || (ar ? "بدون عنوان" : "Untitled"),
            kind: item.kind,
            minutes: item.estimatedMinutes,
            dayKey: item.plannedDate,
            subjectLabel: subject?.name ?? null,
            colorToken: subject?.colorToken
              ? safeColorToken(subject.colorToken)
              : planColorToken(label),
            accepted: item.accepted,
            rejected: item.rejected,
            selectable: !locked && !item.accepted && !item.rejected && Boolean(item.id),
          };
        }),
    [items, subjectById, plan.title, locked, ar],
  );

  function applyPlan(next: ExamPlan) {
    setPlan(next);
    setTitle(next.title);
    setOverview(next.overview ?? "");
    setExamDate(cairoDateInput(next.examAt));
    setItems(draftItems(next));
    setRemovedIds([]);
  }

  function updateItem(key: string, change: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  function removeItem(item: DraftItem) {
    if (item.accepted || item.rejected || locked) return;
    if (item.id) setRemovedIds((current) => [...new Set([...current, item.id!])]);
    setItems((current) => current.filter((candidate) => candidate.key !== item.key));
    if (item.id) setSelectedIds((current) => current.filter((id) => id !== item.id));
  }

  function addItem() {
    if (locked) return;
    setItems((current) => [
      ...current,
      {
        key: `new-${globalThis.crypto.randomUUID()}`,
        id: null,
        title: "",
        notes: "",
        subjectId: "",
        plannedDate: cairoDateInput(new Date()),
        estimatedMinutes: 30,
        kind: "STUDY",
        accepted: false,
        rejected: false,
        createdTask: null,
      },
    ]);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exam-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          overview: overview || null,
          ...(hasAcceptedItems ? {} : { examAt: examDate }),
          items: items
            .filter((item) => !item.accepted && !item.rejected)
            .map((item, sortOrder) => ({
              id: item.id ?? undefined,
              title: item.title,
              notes: item.notes || null,
              subjectId: item.subjectId || null,
              plannedDate: item.plannedDate,
              estimatedMinutes: item.estimatedMinutes,
              kind: item.kind,
              sortOrder,
            })),
          removeItemIds: removedIds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(examPlanErrorMessage(payload, ar));
        return;
      }
      applyPlan(payload.plan);
      setNotice(ar ? "تم حفظ المقترح." : "Proposal saved.");
      router.refresh();
    } catch {
      setError(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
    }
  }

  async function acceptSelected() {
    if (!confirmed || !selectedIds.length) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exam-plans/${plan.id}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemIds: selectedIds, confirmTaskCreation: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(examPlanErrorMessage(payload, ar));
        return;
      }
      applyPlan(payload.plan);
      setSelectedIds([]);
      setConfirmationOpen(false);
      setConfirmed(false);
      setNotice(
        ar
          ? `تم إنشاء ${payload.createdTaskIds.length} مهمة.`
          : `${payload.createdTaskIds.length} task${payload.createdTaskIds.length === 1 ? "" : "s"} created.`,
      );
      router.refresh();
    } catch {
      setError(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
    }
  }

  async function rejectPlan() {
    const agreed = window.confirm(
      ar
        ? "هل تريد رفض العناصر المتبقية؟ ستظل المهام التي أنشأتها سابقًا موجودة."
        : "Reject the remaining proposal? Tasks you already created will stay in your task list.",
    );
    if (!agreed) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/exam-plans/${plan.id}/reject`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(examPlanErrorMessage(payload, ar));
        return;
      }
      applyPlan(payload.plan);
      setSelectedIds([]);
      setConfirmationOpen(false);
      setNotice(ar ? "تم إغلاق المقترح." : "Proposal closed.");
      router.refresh();
    } catch {
      setError(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
    }
  }

  /**
   * Publish, or update what is already published.
   *
   * This is the one action that makes the plan a *shareable* thing: it writes the proposal into the
   * Plan Forum's own tables, which is what the calendar overlay, the sticky-note board and per-day
   * copy-to-tasks already read. Pressing it a second time updates the same forum plan rather than
   * making a second one, so a link already sent to classmates keeps working.
   */
  async function publish() {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/exam-plans/${plan.id}/publish`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(examPlanErrorMessage(payload, ar));
        return;
      }
      setStudyPlanId(payload.studyPlanId);
      setNotice(
        payload.republished
          ? ar
            ? "تم تحديث الخطة على المنتدى."
            : "The forum copy is up to date."
          : ar
            ? `تم نشر ${payload.itemCount} عنصرًا على المنتدى.`
            : `${payload.itemCount} item${payload.itemCount === 1 ? "" : "s"} published to the forum.`,
      );
      router.refresh();
    } catch {
      setError(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    setConfirmationOpen(false);
    setConfirmed(false);
  }

  return (
    <main className="exam-plan-detail-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="exam-plan-detail-header">
        <div className="page-header-text">
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">
            {ar ? "خطة امتحان AI · مقترح قابل للتعديل" : "AI Exam Plan · editable proposal"}
          </p>
          <h1>{plan.title}</h1>
        </div>
        {/* The segmented pill /exam-plans/new already uses. Bare, this was three inline anchors with
            no gap between them, which read as one word: "New planTasksInsights". */}
        <nav className="page-header" aria-label={ar ? "تنقل الخطة" : "Plan navigation"}>
          <Link href="/exam-plans/new">{ar ? "خطة جديدة" : "New plan"}</Link>
          <Link href="/tasks">{ar ? "المهام" : "Tasks"}</Link>
          <Link href="/insights">{ar ? "الرؤى" : "Insights"}</Link>
        </nav>
      </header>

      <section className="exam-plan-share" aria-label={ar ? "مشاركة الخطة" : "Plan sharing"}>
        <button
          className="primary-button"
          type="button"
          disabled={pending || !items.some((item) => !item.rejected)}
          onClick={publish}
        >
          <Share2 aria-hidden="true" className="w-4 h-4" />
          {studyPlanId
            ? ar
              ? "تحديث على المنتدى"
              : "Update on the forum"
            : ar
              ? "انشر في منتدى الخطط"
              : "Publish to Plan Forum"}
        </button>
        {studyPlanId && (
          <>
            <Link className="secondary-button" href={`/plan-forum/${studyPlanId}`}>
              <ExternalLink aria-hidden="true" className="w-4 h-4" />
              {ar ? "افتح في المنتدى" : "Open on the forum"}
            </Link>
            <Link
              className="secondary-button"
              href={`/calendar?source=plan&planId=${studyPlanId}`}
            >
              <CalendarRange aria-hidden="true" className="w-4 h-4" />
              {ar ? "اعرض على التقويم" : "Apply on calendar"}
            </Link>
          </>
        )}
        <p className="muted-copy">
          {studyPlanId
            ? ar
              ? "الخطة على رفّك الخاص. المشاركة مع دفعتك زر منفصل داخل المنتدى."
              : "The plan is on your own shelf. Sharing it with your year is a separate press on the forum."
            : ar
              ? "النشر يحوّل المقترح إلى لوحة ملاحظات: قابلة للمشاركة، وتظهر على التقويم."
              : "Publishing turns the proposal into a sticky-note board: shareable, and visible on the calendar."}
        </p>
      </section>

      <section
        className="exam-plan-attribution"
        aria-label={ar ? "نسبة الذكاء الاصطناعي" : "AI attribution"}
      >
        <span className="ai-label">AI</span>
        {/* Each fact is a labelled figure, not a sentence: without the class these were three bare
            divs whose `strong` and `span` sat inline, reading "Proposal readyopenai/gpt-oss-120b". */}
        <div className="exam-plan-fact">
          <strong>{statusLabel(plan.status, ar)}</strong>
          <span>
            {plan.model} · {plan.promptVersion}
          </span>
        </div>
        <div className="exam-plan-fact">
          <strong>
            {acceptedCount} / {items.length}
          </strong>
          <span>{ar ? "عناصر تحولت إلى مهام" : "items converted to tasks"}</span>
        </div>
        <div className="exam-plan-fact">
          <strong>{plan.contextPurgedAt ? (ar ? "تم الحذف" : "Purged") : "30 days"}</strong>
          <span>{ar ? "احتفاظ نص المنهج" : "syllabus-context retention"}</span>
        </div>
      </section>

      <form className="exam-plan-editor" onSubmit={save}>
        <section className="exam-plan-meta" aria-labelledby="plan-overview-title">
          <div className="section-heading">
            <h2 id="plan-overview-title">{ar ? "نظرة عامة" : "Overview"}</h2>
            {!locked && (
              <button className="secondary-button" disabled={pending} type="submit">
                {pending ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "حفظ التعديلات" : "Save changes"}
              </button>
            )}
          </div>
          <div className="form-grid">
            <label>
              {ar ? "اسم الخطة" : "Plan title"}
              <input
                required
                maxLength={120}
                value={title}
                disabled={locked}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              {ar ? "تاريخ الامتحان" : "Exam date"}
              <input
                type="date"
                value={examDate}
                disabled={locked || hasAcceptedItems}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </label>
          </div>
          <label>
            {ar ? "ملخص المقترح" : "Proposal summary"}
            <textarea
              rows={4}
              maxLength={1_000}
              value={overview}
              disabled={locked}
              onChange={(event) => setOverview(event.target.value)}
            />
          </label>
        </section>

        <section className="exam-plan-items" aria-labelledby="plan-items-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ar ? "المراجعة الانتقائية" : "Selective review"}</p>
              <h2 id="plan-items-title">{ar ? "عناصر الخطة" : "Plan items"}</h2>
            </div>
            {!locked && view === "list" && (
              <button className="secondary-button" type="button" onClick={addItem}>
                {ar ? "إضافة عنصر" : "Add item"}
              </button>
            )}
          </div>

          {/* Two readings of one list. The board is for judging the shape of the plan and ticking
              what to keep; the list is where a field actually gets edited. Both are views over the
              same `items` state, so a selection survives switching. */}
          <div className="exam-view-tabs" role="tablist" aria-label={ar ? "طريقة العرض" : "View"}>
            <button
              type="button"
              role="tab"
              aria-selected={view === "board"}
              onClick={() => setView("board")}
            >
              <LayoutGrid aria-hidden="true" className="w-4 h-4" />
              {ar ? "اللوحة" : "Board"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
            >
              <List aria-hidden="true" className="w-4 h-4" />
              {ar ? "القائمة" : "List"}
            </button>
          </div>

          {view === "board" ? (
            <ExamPlanBoard
              ar={ar}
              items={boardItems}
              examDateKey={examDate}
              todayKey={cairoDateInput(new Date())}
              selectedIds={selectedIds}
              onToggle={toggleSelection}
            />
          ) : (
            <div className="exam-plan-item-list">
            {items.map((item, index) => {
              const editable = !locked && !item.accepted && !item.rejected;
              const selectable = editable && Boolean(item.id);
              return (
                <article
                  key={item.key}
                  className="exam-plan-item"
                  data-selected={item.id ? selectedIds.includes(item.id) : false}
                  data-accepted={item.accepted}
                >
                  <div className="exam-plan-item-heading">
                    <label className="plan-item-select">
                      <input
                        type="checkbox"
                        checked={Boolean(item.id && selectedIds.includes(item.id))}
                        disabled={!selectable}
                        onChange={() => item.id && toggleSelection(item.id)}
                      />
                      <span>
                        {item.accepted
                          ? ar
                            ? "تم إنشاء المهمة"
                            : "Task created"
                          : item.rejected
                            ? ar
                              ? "مرفوض"
                              : "Rejected"
                            : ar
                              ? `العنصر ${index + 1}`
                              : `Item ${index + 1}`}
                      </span>
                    </label>
                    {editable && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => removeItem(item)}
                      >
                        {ar ? "إزالة" : "Remove"}
                      </button>
                    )}
                  </div>
                  <label>
                    {ar ? "العنوان" : "Title"}
                    <input
                      required
                      value={item.title}
                      disabled={!editable}
                      onChange={(event) => updateItem(item.key, { title: event.target.value })}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      {ar ? "المادة" : "Subject"}
                      <select
                        value={item.subjectId}
                        disabled={!editable}
                        onChange={(event) =>
                          updateItem(item.key, { subjectId: event.target.value })
                        }
                      >
                        <option value="">{ar ? "بدون مادة" : "No subject"}</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {ar ? "اليوم المخطط" : "Planned date"}
                      <input
                        type="date"
                        value={item.plannedDate}
                        max={examDate}
                        disabled={!editable}
                        onChange={(event) =>
                          updateItem(item.key, { plannedDate: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="form-grid">
                    <label>
                      {ar ? "الدقائق المقدرة" : "Estimated minutes"}
                      <input
                        type="number"
                        min={15}
                        max={360}
                        value={item.estimatedMinutes}
                        disabled={!editable}
                        onChange={(event) =>
                          updateItem(item.key, { estimatedMinutes: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label>
                      {ar ? "نوع العنصر" : "Item kind"}
                      <select
                        value={item.kind}
                        disabled={!editable}
                        onChange={(event) =>
                          updateItem(item.key, { kind: event.target.value as ExamItemKind })
                        }
                      >
                        {EXAM_ITEM_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {ar ? KIND_LABEL[kind].ar : KIND_LABEL[kind].en}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {ar ? "ملاحظات" : "Notes"}
                    <textarea
                      rows={3}
                      value={item.notes}
                      disabled={!editable}
                      onChange={(event) => updateItem(item.key, { notes: event.target.value })}
                    />
                  </label>
                  {!item.id && (
                    <p className="muted-copy">
                      {ar
                        ? "احفظ المقترح قبل اختيار هذا العنصر."
                        : "Save before selecting this new item."}
                    </p>
                  )}
                  {item.createdTask && (
                    <Link className="created-task-link" href={`/tasks/${item.createdTask.id}`}>
                      {ar ? "فتح المهمة المنشأة" : "Open created task"}
                    </Link>
                  )}
                </article>
              );
            })}
            </div>
          )}
        </section>
      </form>

      {!locked && (
        <section className="exam-plan-conversion" aria-labelledby="conversion-title">
          <div>
            <p className="eyebrow">{ar ? "تأكيد منفصل" : "Separate confirmation"}</p>
            <h2 id="conversion-title">
              {ar ? "تحويل العناصر المختارة" : "Convert selected items"}
            </h2>
            <p>
              {ar
                ? `${selectedCount} من ${selectableIds.length} عنصرًا محددًا.`
                : `${selectedCount} of ${selectableIds.length} available items selected.`}
            </p>
          </div>
          {!confirmationOpen ? (
            <button
              className="primary-button"
              type="button"
              disabled={!selectedCount || pending}
              onClick={() => setConfirmationOpen(true)}
            >
              {ar ? "مراجعة إنشاء المهام" : "Review task creation"}
            </button>
          ) : (
            <div className="task-conversion-confirmation" role="region" aria-live="polite">
              <strong>
                {ar
                  ? `سيتم إنشاء ${selectedCount} مهمة مملوكة لك.`
                  : `${selectedCount} owned task${selectedCount === 1 ? "" : "s"} will be created.`}
              </strong>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  {ar
                    ? "راجعت العناصر وأؤكد إنشاء المهام المختارة."
                    : "I reviewed the items and confirm creating the selected tasks."}
                </span>
              </label>
              <div className="form-actions">
                <button
                  className="primary-button"
                  type="button"
                  disabled={!confirmed || pending}
                  onClick={acceptSelected}
                >
                  {pending
                    ? ar
                      ? "جارٍ الإنشاء…"
                      : "Creating…"
                    : ar
                      ? "إنشاء المهام"
                      : "Create tasks"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setConfirmationOpen(false);
                    setConfirmed(false);
                  }}
                >
                  {ar ? "رجوع" : "Back"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Both paragraphs stay mounted whether or not they hold anything -- a live region that is
          inserted at the same moment as its text is announced unreliably -- so it is the frame that
          comes and goes, via `data-visible`. Unframed, this rendered as an empty bordered box. */}
      <div className="exam-plan-feedback" data-visible={error || notice ? "yes" : "no"}>
        <p className="form-error" role="alert">
          {error}
        </p>
        <p className="success-copy" role="status" aria-live="polite">
          {notice}
        </p>
      </div>

      {!locked && (
        <section className="exam-plan-reject-zone">
          <div>
            <h2>{ar ? "رفض المقترح المتبقي" : "Reject remaining proposal"}</h2>
            <p>
              {ar
                ? "لن تُحذف المهام التي أنشأتها بالفعل."
                : "Tasks already created from this plan will not be deleted."}
            </p>
          </div>
          <button
            className="text-button danger"
            type="button"
            disabled={pending}
            onClick={rejectPlan}
          >
            {ar ? "رفض المتبقي" : "Reject remaining"}
          </button>
        </section>
      )}
    </main>
  );
}

function statusLabel(status: string, ar: boolean) {
  const english: Record<string, string> = {
    PROPOSED: "Proposal ready",
    PARTIALLY_ACCEPTED: "Partially accepted",
    ACCEPTED: "All items accepted",
    REJECTED: "Proposal rejected",
    GENERATING: "Generating",
  };
  const arabic: Record<string, string> = {
    PROPOSED: "المقترح جاهز",
    PARTIALLY_ACCEPTED: "مقبول جزئيًا",
    ACCEPTED: "تم قبول كل العناصر",
    REJECTED: "تم رفض المقترح",
    GENERATING: "قيد الإنشاء",
  };
  return (ar ? arabic : english)[status] ?? status;
}
