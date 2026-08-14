"use client";
import { useState } from "react";
import type { Subject, Task } from "./types";

type Props = {
  subjects: Subject[];
  locale: "en" | "ar";
  initial?: Partial<Task>;
  parentTaskId?: string;
  onSaved: () => void;
  onCancel?: () => void;
};
export function TaskForm({ subjects, locale, initial, parentTaskId, onSaved, onCancel }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const edit = Boolean(initial?.id);
  const t = locale === "ar";
  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const frequency = String(formData.get("frequency") || "");
    const dueLocal = String(formData.get("dueAt") || "");
    const body = {
      title: formData.get("title"),
      notes: formData.get("notes") || null,
      subjectId: formData.get("subjectId") || null,
      parentTaskId: parentTaskId ?? null,
      priority: formData.get("priority"),
      dueAt: dueLocal ? new Date(dueLocal).toISOString() : null,
      estimatedMinutes: formData.get("estimatedMinutes") || null,
      recurrenceRule: frequency
        ? frequency === "DAILY"
          ? { frequency, interval: 1 }
          : { frequency, interval: 1, weekDays: [new Date(dueLocal || Date.now()).getDay()] }
        : null,
    };
    const response = await fetch(edit ? `/api/tasks/${initial?.id}` : "/api/tasks", {
      method: edit ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!response.ok) {
      setError(
        t ? "تعذر حفظ المهمة. راجع البيانات." : "Could not save the task. Check the fields.",
      );
      return;
    }
    onSaved();
  }
  const due = initial?.dueAt ? new Date(initial.dueAt).toISOString().slice(0, 16) : "";
  return (
    <form action={submit} className="task-form">
      <label>
        {t ? "عنوان المهمة" : "Task title"}
        <input name="title" required maxLength={180} defaultValue={initial?.title ?? ""} />
      </label>
      <label>
        {t ? "ملاحظات" : "Notes"}
        <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} />
      </label>
      <div className="form-grid">
        <label>
          {t ? "المادة" : "Subject"}
          <select name="subjectId" defaultValue={initial?.subject?.id ?? ""}>
            <option value="">{t ? "بدون مادة" : "No subject"}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t ? "الأولوية" : "Priority"}
          <select name="priority" defaultValue={initial?.priority ?? "MEDIUM"}>
            <option value="LOW">{t ? "منخفضة" : "Low"}</option>
            <option value="MEDIUM">{t ? "متوسطة" : "Medium"}</option>
            <option value="HIGH">{t ? "عالية" : "High"}</option>
            <option value="URGENT">{t ? "عاجلة" : "Urgent"}</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          {t ? "موعد الاستحقاق" : "Due date"}
          <input name="dueAt" type="datetime-local" defaultValue={due} />
        </label>
        <label>
          {t ? "الوقت المتوقع (دقيقة)" : "Estimated minutes"}
          <input
            name="estimatedMinutes"
            type="number"
            min="5"
            max="1440"
            defaultValue={initial?.estimatedMinutes ?? ""}
          />
        </label>
      </div>
      {!parentTaskId && (
        <label>
          {t ? "التكرار" : "Recurrence"}
          <select
            name="frequency"
            defaultValue={
              (initial?.recurrenceRule as { frequency?: string } | null)?.frequency ?? ""
            }
          >
            <option value="">{t ? "لا يتكرر" : "Does not repeat"}</option>
            <option value="DAILY">{t ? "يوميًا" : "Daily"}</option>
            <option value="WEEKLY">{t ? "أسبوعيًا" : "Weekly"}</option>
          </select>
        </label>
      )}
      <p className="form-error" role="alert">
        {error}
      </p>
      <div className="form-actions">
        <button className="primary-button" disabled={pending}>
          {pending ? (t ? "جارٍ الحفظ…" : "Saving…") : t ? "حفظ المهمة" : "Save task"}
        </button>
        {onCancel && (
          <button type="button" className="secondary-button" onClick={onCancel}>
            {t ? "إلغاء" : "Cancel"}
          </button>
        )}
      </div>
    </form>
  );
}
