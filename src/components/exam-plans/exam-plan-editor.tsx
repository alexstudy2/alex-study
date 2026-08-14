"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ExamPlan, SubjectOption } from "./types";

type DraftItem = {
  key: string;
  id: string | null;
  title: string;
  notes: string;
  subjectId: string;
  plannedDate: string;
  estimatedMinutes: number;
  accepted: boolean;
  rejected: boolean;
  createdTask: { id: string; title: string; status: string } | null;
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
  const locked =
    Boolean(plan.rejectedAt) || plan.status === "ACCEPTED" || plan.status === "REJECTED";
  const hasAcceptedItems = items.some((item) => item.accepted);
  const acceptedCount = items.filter((item) => item.accepted).length;
  const selectedCount = selectedIds.length;
  const selectableIds = useMemo(
    () => items.flatMap((item) => (item.id && !item.accepted && !item.rejected ? [item.id] : [])),
    [items],
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
              sortOrder,
            })),
          removeItemIds: removedIds,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(planError(payload.error, ar));
        return;
      }
      applyPlan(payload.plan);
      setNotice(ar ? "تم حفظ المقترح." : "Proposal saved.");
      router.refresh();
    } catch {
      setError(ar ? "تعذر حفظ المقترح." : "The proposal could not be saved.");
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
        setError(planError(payload.error, ar));
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
      setError(ar ? "تعذر إنشاء المهام." : "The tasks could not be created.");
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
        setError(planError(payload.error, ar));
        return;
      }
      applyPlan(payload.plan);
      setSelectedIds([]);
      setConfirmationOpen(false);
      setNotice(ar ? "تم إغلاق المقترح." : "Proposal closed.");
      router.refresh();
    } catch {
      setError(ar ? "تعذر رفض المقترح." : "The proposal could not be rejected.");
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
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">AI · {ar ? "مقترح قابل للتعديل" : "editable proposal"}</p>
          <h1>{plan.title}</h1>
        </div>
        <nav aria-label={ar ? "تنقل الخطة" : "Plan navigation"}>
          <Link href="/exam-plans/new">{ar ? "خطة جديدة" : "New plan"}</Link>
          <Link href="/tasks">{ar ? "المهام" : "Tasks"}</Link>
          <Link href="/insights">{ar ? "الرؤى" : "Insights"}</Link>
        </nav>
      </header>

      <section
        className="exam-plan-attribution"
        aria-label={ar ? "نسبة الذكاء الاصطناعي" : "AI attribution"}
      >
        <span className="ai-label">AI</span>
        <div>
          <strong>{statusLabel(plan.status, ar)}</strong>
          <span>
            {plan.model} · {plan.promptVersion}
          </span>
        </div>
        <div>
          <strong>
            {acceptedCount} / {items.length}
          </strong>
          <span>{ar ? "عناصر تحولت إلى مهام" : "items converted to tasks"}</span>
        </div>
        <div>
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
            {!locked && (
              <button className="secondary-button" type="button" onClick={addItem}>
                {ar ? "إضافة عنصر" : "Add item"}
              </button>
            )}
          </div>

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

      <div className="exam-plan-feedback">
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

function planError(code: string | undefined, ar: boolean) {
  const english: Record<string, string> = {
    invalid_request: "Review the highlighted plan values.",
    invalid_item_date: "Every study date must be between today and the exam.",
    invalid_item_count: "Keep at least one and at most sixty plan items.",
    invalid_subject: "One selected subject is not available.",
    accepted_item_locked: "A task-created item can no longer be edited.",
    exam_date_locked: "The exam date is locked after the first task is created.",
    plan_locked: "This proposal is closed.",
    item_not_found: "One selected item no longer belongs to this plan.",
    server_error: "The plan could not be updated. Try again.",
  };
  const arabic: Record<string, string> = {
    invalid_request: "راجع قيم الخطة المدخلة.",
    invalid_item_date: "يجب أن تكون كل المواعيد بين اليوم والامتحان.",
    invalid_item_count: "احتفظ بعنصر واحد على الأقل وبستين عنصرًا كحد أقصى.",
    invalid_subject: "إحدى المواد المختارة غير متاحة.",
    accepted_item_locked: "لا يمكن تعديل عنصر تحوّل إلى مهمة.",
    exam_date_locked: "يُقفل تاريخ الامتحان بعد إنشاء أول مهمة.",
    plan_locked: "هذا المقترح مغلق.",
    item_not_found: "أحد العناصر المحددة لم يعد ضمن الخطة.",
    server_error: "تعذر تحديث الخطة. حاول مرة أخرى.",
  };
  return (
    (ar ? arabic : english)[code ?? ""] ??
    (ar ? "تعذر إكمال الطلب." : "The request could not be completed.")
  );
}
