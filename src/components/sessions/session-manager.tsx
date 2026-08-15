"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManualSessionForm } from "./manual-session-form";

type Option = { id: string; title?: string; name?: string };
type InitialSession = Parameters<typeof ManualSessionForm>[0]["initial"];

export function SessionManager({ locale, subjects, tasks, initial }: { locale: "en" | "ar"; subjects: Option[]; tasks: Option[]; initial?: InitialSession }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!initial || !window.confirm(ar ? "حذف هذا السيشن نهائيًا؟" : "Delete this session permanently?")) return;
    const response = await fetch(`/api/sessions/${initial.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(ar ? "تعذر حذف السيشن." : "Could not delete the session.");
      return;
    }
    router.push("/sessions");
    router.refresh();
  }

  return (
    <div className="session-manager">
      <div className="inline-actions">
        <Button variant="secondary" size="sm" leftIcon={initial ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />} onClick={() => setOpen((value) => !value)}>{initial ? (ar ? "تعديل السيشن" : "Edit session") : (ar ? "إضافة سيشن يدوي" : "Add manual session")}</Button>
        {initial && <Button variant="danger" size="sm" leftIcon={<Trash2 className="w-4 h-4" />} onClick={remove}>{ar ? "حذف" : "Delete"}</Button>}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {open && <div className="manual-session-panel"><ManualSessionForm locale={locale} subjects={subjects} tasks={tasks} initial={initial} onDone={() => setOpen(false)} /></div>}
    </div>
  );
}
