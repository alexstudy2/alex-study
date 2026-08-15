"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickAddDashboard({ ar }: { ar: boolean }) {
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status: "TODO" }),
      });

      if (res.ok) {
        setTitle("");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        router.refresh();
      } else {
        setError(ar ? "تعذر حفظ المهمة." : "Could not save the task.");
      }
    } catch {
      setError(ar ? "تعذر الاتصال بالخادم." : "Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="dashboard-quick-add">
      <div className="dashboard-quick-add-field">
        <Plus className="w-4 h-4 text-muted" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={ar ? "أضف مهمة سريعة..." : "Quick add a task..."}
          disabled={isSubmitting}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={isSubmitting || !title.trim()}
        leftIcon={showSuccess ? <CheckCircle2 className="w-4 h-4" /> : undefined}
      >
        {showSuccess
          ? ar ? "تمت!" : "Added!"
          : ar ? "إضافة" : "Add"}
      </Button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
