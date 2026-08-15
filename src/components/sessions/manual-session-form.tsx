"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Option = { id: string; title?: string; name?: string };
type InitialSession = {
  id: string;
  taskId: string | null;
  subjectId: string | null;
  startedAt: string;
  endedAt: string;
  plannedDurationSeconds: number;
  distractionCount: number;
  reflection: string | null;
};

function localInput(value: string) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function ManualSessionForm({
  locale,
  subjects,
  tasks,
  initial,
  onDone,
}: {
  locale: "en" | "ar";
  subjects: Option[];
  tasks: Option[];
  initial?: InitialSession;
  onDone?: () => void;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const now = new Date();
  const defaultEnd = localInput(initial?.endedAt ?? now.toISOString());
  const defaultStart = localInput(initial?.startedAt ?? new Date(now.getTime() - 50 * 60000).toISOString());

  async function submit(formData: FormData) {
    setPending(true);
    setError("");
    const startedAt = new Date(String(formData.get("startedAt")));
    const endedAt = new Date(String(formData.get("endedAt")));
    const plannedMinutes = Number(formData.get("plannedMinutes"));
    const response = await fetch(initial ? `/api/sessions/${initial.id}` : "/api/sessions", {
      method: initial ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: formData.get("taskId") || null,
        subjectId: formData.get("subjectId") || null,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        plannedDurationSeconds: plannedMinutes * 60,
        distractionCount: Number(formData.get("distractionCount")),
        reflection: formData.get("reflection") || "",
      }),
    });
    setPending(false);
    if (!response.ok) {
      setError(ar ? "تعذر حفظ السيشن. راجع الوقت والبيانات." : "Could not save the session. Check the times and fields.");
      return;
    }
    onDone?.();
    router.refresh();
  }

  return (
    <form action={submit} className="manual-session-form">
      <div className="form-grid">
        <label>{ar ? "البداية" : "Started at"}<input name="startedAt" type="datetime-local" required defaultValue={defaultStart} /></label>
        <label>{ar ? "النهاية" : "Ended at"}<input name="endedAt" type="datetime-local" required defaultValue={defaultEnd} /></label>
      </div>
      <div className="form-grid">
        <label>{ar ? "المادة" : "Subject"}<select name="subjectId" defaultValue={initial?.subjectId ?? ""}><option value="">{ar ? "بدون مادة" : "No subject"}</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>{ar ? "المهمة" : "Task"}<select name="taskId" defaultValue={initial?.taskId ?? ""}><option value="">{ar ? "بدون مهمة" : "No task"}</option>{tasks.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
      </div>
      <div className="form-grid">
        <label>{ar ? "المدة المخططة بالدقائق" : "Planned minutes"}<input name="plannedMinutes" type="number" min="1" max="720" required defaultValue={Math.round((initial?.plannedDurationSeconds ?? 3000) / 60)} /></label>
        <label>{ar ? "عدد مرات التشتت" : "Distractions"}<input name="distractionCount" type="number" min="0" max="999" required defaultValue={initial?.distractionCount ?? 0} /></label>
      </div>
      <label>{ar ? "ملاحظات أو تأمل" : "Reflection"}<textarea name="reflection" rows={3} maxLength={1000} defaultValue={initial?.reflection ?? ""} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><Button type="submit" isLoading={pending}>{initial ? (ar ? "حفظ التعديل" : "Save changes") : (ar ? "إضافة السيشن" : "Add session")}</Button>{onDone && <Button type="button" variant="ghost" onClick={onDone}>{ar ? "إلغاء" : "Cancel"}</Button>}</div>
    </form>
  );
}
