"use client";

import { useState } from "react";
import { Sparkles, Check, X, ArrowRight, ArrowLeft } from "lucide-react";
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
          : "Could not parse that task."
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
    <section className="quick-add-panel" aria-labelledby="quick-add-title">
      <div className="quick-add-info">
        <span className="quick-add-badge">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{ar ? "المساعد الذكي" : "AI-Assisted Draft"}</span>
        </span>
        <h2 id="quick-add-title" className="quick-add-title">
          {ar ? "حوّل فكرتك إلى مسودة" : "Turn a thought into a draft"}
        </h2>
        <p className="quick-add-subtitle">
          {ar
            ? "اكتب مهمتك بشكل طبيعي وسيقوم الذكاء الاصطناعي باستخراج الوقت والمادة والأولوية للمراجعة."
            : "Describe your study plan in natural language. We'll parse the time, course, and priority."}
        </p>
      </div>

      {!draft ? (
        <form action={parse} className="quick-add-input-wrapper">
          <label className="sr-only" htmlFor="quick-text">
            {ar ? "صف المهمة" : "Describe the task"}
          </label>
          <div className="quick-add-input-row">
            <input
              id="quick-text"
              name="text"
              required
              className="quick-add-input"
              placeholder={
                ar
                  ? "مثال: مراجعة التشريح غدًا الساعة 5 مساءً لمدة 45 دقيقة..."
                  : "e.g. Review anatomy tomorrow at 5 PM for 45 minutes..."
              }
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={pending}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              {ar ? "توليد المسودة" : "Create draft"}
            </Button>
          </div>
        </form>
      ) : (
        <form action={(fd) => decide(true, fd)} className="draft-editor-card">
          <div className="flex items-center gap-2 pb-2 border-b border-line">
            <Sparkles className="w-4 h-4 text-primary" />
            <strong className="text-sm font-semibold text-foreground">
              {ar ? "مراجعة المسودة المستخرجة" : "Review Extracted Draft"}
            </strong>
          </div>

          <div className="grid gap-3 pt-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              <span>{ar ? "عنوان المهمة" : "Task Title"}</span>
              <input
                name="title"
                required
                defaultValue={draft.title}
                className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "المادة" : "Subject"}</span>
                <select
                  name="subjectId"
                  defaultValue={draft.subjectId ?? ""}
                  className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                  className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="LOW">{ar ? "منخفضة (Low)" : "LOW"}</option>
                  <option value="MEDIUM">{ar ? "متوسطة (Medium)" : "MEDIUM"}</option>
                  <option value="HIGH">{ar ? "عالية (High)" : "HIGH"}</option>
                  <option value="URGENT">{ar ? "عاجلة (Urgent)" : "URGENT"}</option>
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
                  className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                <span>{ar ? "المدة المتوقعة (دقائق)" : "Estimated Minutes"}</span>
                <input
                  name="estimatedMinutes"
                  type="number"
                  min="5"
                  defaultValue={draft.estimatedMinutes ?? ""}
                  className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              <span>{ar ? "ملاحظات إضافية" : "Additional Notes"}</span>
              <textarea
                name="notes"
                defaultValue={draft.notes ?? ""}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md border border-line bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={pending}
              leftIcon={<Check className="w-4 h-4" />}
            >
              {ar ? "تأكيد وحفظ المهمة" : "Confirm and Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<X className="w-4 h-4" />}
              onClick={() => decide(false)}
            >
              {ar ? "إلغاء المسودة" : "Discard"}
            </Button>
          </div>
        </form>
      )}

      {message && (
        <p className="form-error mt-3 text-sm" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
