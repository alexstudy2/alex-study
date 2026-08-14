"use client";
import { useState } from "react";
import type { Subject, TaskDraft } from "./types";
export function QuickAdd({
  locale,
  subjects,
  onSaved,
}: {
  locale: "en" | "ar";
  subjects: Subject[];
  onSaved: () => void;
}) {
  const ar = locale === "ar";
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function parse(formData: FormData) {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/tasks/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: formData.get("text"), locale }),
    });
    const data = await response.json();
    setPending(false);
    if (!response.ok) {
      setMessage(
        data.error === "ai_unavailable"
          ? ar
            ? "الإضافة الذكية غير متاحة الآن. استخدم نموذج المهمة."
            : "AI quick-add is unavailable. Use the task form."
          : ar
            ? "تعذر تحليل المهمة."
            : "Could not parse that task.",
      );
      return;
    }
    setDraft(data.draft);
  }
  async function decide(accept: boolean, formData?: FormData) {
    if (!draft) return;
    setPending(true);
    const body = formData
      ? {
          title: formData.get("title"),
          notes: formData.get("notes") || null,
          subjectId: formData.get("subjectId") || null,
          priority: formData.get("priority"),
          dueAt: formData.get("dueAt")
            ? new Date(String(formData.get("dueAt"))).toISOString()
            : null,
          estimatedMinutes: formData.get("estimatedMinutes") || null,
        }
      : {};
    const response = await fetch(`/api/tasks/parse/${draft.id}/${accept ? "accept" : "reject"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (response.ok) {
      setDraft(null);
      if (accept) onSaved();
    }
  }
  return (
    <section className="quick-add" aria-labelledby="quick-add-title">
      <div>
        <p className="eyebrow">{ar ? "بمساعدة الذكاء الاصطناعي" : "AI-assisted"}</p>
        <h2 id="quick-add-title">{ar ? "حوّل فكرتك إلى مسودة" : "Turn a thought into a draft"}</h2>
        <p>
          {ar
            ? "لن تُحفظ أي مهمة قبل مراجعتك وتأكيدك."
            : "Nothing is saved as a task until you review and confirm it."}
        </p>
      </div>
      {!draft ? (
        <form action={parse} className="quick-add-row">
          <label className="sr-only" htmlFor="quick-text">
            {ar ? "صف المهمة" : "Describe the task"}
          </label>
          <input
            id="quick-text"
            name="text"
            required
            placeholder={
              ar
                ? "مثال: راجع التشريح غدًا لمدة 45 دقيقة"
                : "e.g. Review anatomy tomorrow for 45 minutes"
            }
          />
          <button className="primary-button" disabled={pending}>
            {pending ? "…" : ar ? "إنشاء مسودة" : "Create draft"}
          </button>
        </form>
      ) : (
        <form action={(fd) => decide(true, fd)} className="draft-editor">
          <p className="draft-label">
            {ar ? "مسودة مولّدة — راجعها" : "Generated draft — review it"}
          </p>
          <label>
            {ar ? "العنوان" : "Title"}
            <input name="title" required defaultValue={draft.title} />
          </label>
          <div className="form-grid">
            <label>
              {ar ? "المادة" : "Subject"}
              <select name="subjectId" defaultValue={draft.subjectId ?? ""}>
                <option value="">{draft.subjectName ?? (ar ? "بدون مادة" : "No subject")}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {ar ? "الأولوية" : "Priority"}
              <select name="priority" defaultValue={draft.priority}>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>URGENT</option>
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label>
              {ar ? "الاستحقاق" : "Due"}
              <input
                name="dueAt"
                type="datetime-local"
                defaultValue={draft.dueAt ? new Date(draft.dueAt).toISOString().slice(0, 16) : ""}
              />
            </label>
            <label>
              {ar ? "الدقائق" : "Minutes"}
              <input
                name="estimatedMinutes"
                type="number"
                min="5"
                defaultValue={draft.estimatedMinutes ?? ""}
              />
            </label>
          </div>
          <label>
            {ar ? "ملاحظات" : "Notes"}
            <textarea name="notes" defaultValue={draft.notes ?? ""} />
          </label>
          <div className="form-actions">
            <button className="primary-button" disabled={pending}>
              {ar ? "تأكيد وحفظ" : "Confirm and save"}
            </button>
            <button type="button" className="secondary-button" onClick={() => decide(false)}>
              {ar ? "رفض المسودة" : "Reject draft"}
            </button>
          </div>
        </form>
      )}
      <p className="form-error" role="status">
        {message}
      </p>
    </section>
  );
}
