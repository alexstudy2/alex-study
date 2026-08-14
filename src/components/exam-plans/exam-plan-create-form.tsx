"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Calendar, BookOpen, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type RecentPlan = {
  id: string;
  title: string;
  examAt: string | Date;
  status: string;
  updatedAt: string | Date;
};

function defaultExamDate() {
  const value = new Date(Date.now() + 21 * 24 * 60 * 60 * 1_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function errorMessage(error: string, ar: boolean) {
  switch (error) {
    case "ai_disabled":
      return ar
        ? "مساعد الذكاء الاصطناعي معطّل في إعدادات الخصوصية."
        : "AI assistant is disabled in privacy settings.";
    case "past_exam_date":
      return ar ? "تاريخ الامتحان يجب أن يكون في المستقبل." : "Exam date must be in the future.";
    case "rate_limited":
      return ar
        ? "تجاوزت الحد المسموح. انتظر قليلًا ثم حاول ثانية."
        : "Rate limit reached. Please wait before trying again.";
    default:
      return ar ? "تعذر توليد خطة الامتحان." : "Could not generate an exam plan.";
  }
}

export function ExamPlanCreateForm({
  locale,
  recentPlans,
  aiEnabled,
}: {
  locale: "en" | "ar";
  recentPlans: RecentPlan[];
  aiEnabled: boolean;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function generate(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/exam-plans/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          examAt: formData.get("examAt"),
          syllabusText: formData.get("syllabusText"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(errorMessage(payload.error, ar));
        return;
      }
      router.push(`/exam-plans/${payload.plan.id}`);
    } catch {
      setMessage(
        ar ? "تعذر الاتصال بالخادم. حاول مرة أخرى." : "The server could not be reached. Try again."
      );
    } finally {
      setPending(false);
    }
  }

  const NavArrow = ar ? ArrowLeft : ArrowRight;

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "مخطط امتحان بالذكاء الاصطناعي" : "AI exam planner"}
        title={ar ? "ابدأ بمقترح قابل للتعديل." : "Start with an editable proposal."}
        description={
          ar
            ? "لن تتحول أي خطوة إلى مهمة قبل اختيارك وتأكيدك الصريح."
            : "No plan item becomes a task until you select it and explicitly confirm."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/insights">
              {ar ? "الرؤى" : "Insights"}
            </Link>
            <Link className="page-header-link" href="/tasks">
              {ar ? "المهام" : "Tasks"}
            </Link>
          </div>
        }
      />

      <div className="exam-plan-create-layout">
        <section className="exam-plan-form-panel" aria-labelledby="exam-plan-form-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                AI · {ar ? "مقترح فقط" : "proposal only"}
              </p>
              <h2 id="exam-plan-form-title">{ar ? "بيانات الامتحان" : "Exam details"}</h2>
            </div>
          </div>
          {aiEnabled ? (
            <form action={generate} className="exam-plan-form">
              <label>
                {ar ? "عنوان الامتحان أو المقرر" : "Exam or course title"}
                <input
                  name="title"
                  required
                  maxLength={120}
                  placeholder={ar ? "مثال: امتحان الباطنة النهائي" : "e.g. Final Internal Medicine Exam"}
                />
              </label>
              <label>
                {ar ? "تاريخ الامتحان (بتوقيت القاهرة)" : "Exam date (Cairo time)"}
                <input name="examAt" type="date" required defaultValue={defaultExamDate()} />
              </label>
              <label>
                {ar ? "موضوعات المنهج أو المحاور" : "Syllabus or topics"}
                <textarea
                  name="syllabusText"
                  required
                  rows={6}
                  placeholder={
                    ar
                      ? "الصق الفصول أو الموضوعات الرئيسية هنا..."
                      : "Paste major chapters, modules, or key topics here..."
                  }
                />
              </label>
              {message && (
                <p className="form-error" role="alert">
                  {message}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={pending}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                {ar ? "توليد مقترح الخطة" : "Generate plan proposal"}
              </Button>
            </form>
          ) : (
            <div className="quiet-state">
              <p>
                {ar
                  ? "مساعد الذكاء الاصطناعي معطّل في إعدادات الخصوصية. فعّله لتوليد خطط امتحانات مخصصة."
                  : "AI features are disabled in your privacy settings. Enable them to generate study plans."}
              </p>
              <Button href="/settings" variant="secondary" size="sm">
                {ar ? "الإعدادات" : "Settings"}
              </Button>
            </div>
          )}
        </section>

        <aside className="exam-plan-recent-panel">
          <div className="section-heading">
            <h2>{ar ? "الخطط السابقة" : "Recent plans"}</h2>
          </div>
          {recentPlans.length ? (
            <div className="exam-plan-list">
              {recentPlans.map((plan) => (
                <Link key={plan.id} href={`/exam-plans/${plan.id}`} className="exam-plan-card">
                  <div>
                    <strong>{plan.title}</strong>
                    <time>
                      {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                        dateStyle: "medium",
                        timeZone: "Africa/Cairo",
                      }).format(new Date(plan.examAt))}
                    </time>
                  </div>
                  <NavArrow className="w-4 h-4 text-muted" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-copy">{ar ? "لا توجد خطط سابقة." : "No previous plans."}</p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
