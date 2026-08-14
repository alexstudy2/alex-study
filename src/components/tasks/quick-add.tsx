"use client";

import { useState } from "react";
import { Plus, Check, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  async function handleDirectAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPending(true);
    setMessage("");

    // Check if the user wants natural language parsing or direct add
    // If text mentions duration or dates, attempt parsing, otherwise create directly
    const hasTimeOrDate = /\b(\d+\s*(min|mins|minutes|دقيقة|ساعة|hours?)|today|tomorrow|غدا|اليوم)\b/i.test(text);

    if (hasTimeOrDate) {
      const response = await fetch("/api/tasks/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, locale }),
      });
      const data = await response.json();
      setPending(false);
      if (response.ok && data.draft) {
        setDraft(data.draft);
        return;
      }
    }

    // Direct task creation
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: text.trim(),
        subjectId: subjectId || null,
        priority: priority,
        dueAt: null,
        estimatedMinutes: null,
      }),
    });
    setPending(false);

    if (response.ok) {
      setText("");
      onSaved();
    } else {
      setMessage(ar ? "تعذر إنشاء المهمة." : "Could not create task.");
    }
  }

  async function decideDraft(accept: boolean, formData?: FormData) {
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
      setText("");
      if (accept) onSaved();
    }
  }

  return (
    <div className="task-quick-capture">
      {!draft ? (
        <form onSubmit={handleDirectAdd} className="quick-capture-form">
          <div className="quick-capture-input-row">
            <input
              id="quick-task-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                ar
                  ? "أضف مهمة دراسية جديدة... اضغط Enter للإضافة"
                  : "Add a study task... press Enter to add"
              }
              className="quick-capture-text"
              autoComplete="off"
            />

            <div className="quick-capture-controls">
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="quick-capture-select"
                aria-label={ar ? "المادة" : "Subject"}
              >
                <option value="">{ar ? "كل المواد" : "No subject"}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="quick-capture-select"
                aria-label={ar ? "الأولوية" : "Priority"}
              >
                <option value="LOW">{ar ? "منخفضة" : "Low"}</option>
                <option value="MEDIUM">{ar ? "متوسطة" : "Medium"}</option>
                <option value="HIGH">{ar ? "عالية" : "High"}</option>
                <option value="URGENT">{ar ? "عاجلة" : "Urgent"}</option>
              </select>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={pending}
                disabled={!text.trim()}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                {ar ? "إضافة" : "Add task"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form
          action={(fd) => decideDraft(true, fd)}
          className="p-4 rounded-xl border border-line bg-surface shadow-sm grid gap-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-line">
            <span className="text-sm font-semibold text-foreground">
              {ar ? "مراجعة المهمة قبل الحفظ" : "Review Task Details"}
            </span>
            <span className="text-xs text-muted">
              {ar ? "تم استخراج الوقت والمادة تلقائيًا" : "Parsed from your note"}
            </span>
          </div>

          <div className="grid gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              <span>{ar ? "عنوان المهمة" : "Task Title"}</span>
              <input
                name="title"
                required
                defaultValue={draft.title}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "المادة" : "Subject"}</span>
                <select
                  name="subjectId"
                  defaultValue={draft.subjectId ?? ""}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
                >
                  <option value="">{draft.subjectName ?? (ar ? "بدون مادة" : "No subject")}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "الأولوية" : "Priority"}</span>
                <select
                  name="priority"
                  defaultValue={draft.priority}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
                >
                  <option value="LOW">{ar ? "منخفضة" : "Low"}</option>
                  <option value="MEDIUM">{ar ? "متوسطة" : "Medium"}</option>
                  <option value="HIGH">{ar ? "عالية" : "High"}</option>
                  <option value="URGENT">{ar ? "عاجلة" : "Urgent"}</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "موعد الاستحقاق" : "Due Date"}</span>
                <input
                  name="dueAt"
                  type="datetime-local"
                  defaultValue={
                    draft.dueAt ? new Date(draft.dueAt).toISOString().slice(0, 16) : ""
                  }
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "الوقت التقديري (دقيقة)" : "Estimated Minutes"}</span>
                <input
                  name="estimatedMinutes"
                  type="number"
                  min="5"
                  defaultValue={draft.estimatedMinutes ?? ""}
                  className="w-full px-3 py-1.5 text-sm rounded-md border border-line bg-surface text-foreground"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={pending}
              leftIcon={<Check className="w-3.5 h-3.5" />}
            >
              {ar ? "تأكيد وحفظ" : "Confirm and save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => decideDraft(false)}
            >
              {ar ? "إلغاء" : "Discard"}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p className="text-xs text-danger mt-1.5" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
