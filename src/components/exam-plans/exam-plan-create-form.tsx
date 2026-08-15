"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
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
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [examAt, setExamAt] = useState(defaultExamDate());
  const [syllabusText, setSyllabusText] = useState("");

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
            <div className="wizard-container">
              <div className="wizard-steps">
                <div className={`wizard-step ${step >= 1 ? "active" : ""} ${step > 1 ? "done" : ""}`}>1</div>
                <div className="wizard-step-line" />
                <div className={`wizard-step ${step >= 2 ? "active" : ""} ${step > 2 ? "done" : ""}`}>2</div>
                <div className="wizard-step-line" />
                <div className={`wizard-step ${step >= 3 ? "active" : ""}`}>3</div>
              </div>

              {step === 1 && (
                <div className="wizard-step-content">
                  <label className="ui-label">
                    {ar ? "عنوان الامتحان أو المقرر" : "Exam or course title"}
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder={ar ? "مثال: امتحان الباطنة النهائي" : "e.g. Final Internal Medicine Exam"}
                      className="ui-input"
                    />
                  </label>
                  <label className="ui-label" style={{ marginTop: "var(--space-3)" }}>
                    {ar ? "تاريخ الامتحان (بتوقيت القاهرة)" : "Exam date (Cairo time)"}
                    <input 
                      type="date" 
                      value={examAt} 
                      onChange={(e) => setExamAt(e.target.value)} 
                      className="ui-input"
                    />
                  </label>
                  <div className="wizard-step-actions">
                    <Button 
                      type="button" 
                      onClick={() => setStep(2)} 
                      disabled={!title || !examAt}
                      rightIcon={!ar ? <NavArrow className="w-4 h-4" /> : undefined}
                      leftIcon={ar ? <NavArrow className="w-4 h-4" /> : undefined}
                    >
                      {ar ? "التالي" : "Next"}
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="wizard-step-content">
                  <label className="ui-label">
                    {ar ? "موضوعات المنهج أو المحاور" : "Syllabus or topics"}
                    <textarea
                      value={syllabusText}
                      onChange={(e) => setSyllabusText(e.target.value)}
                      rows={6}
                      placeholder={
                        ar
                          ? "الصق الفصول أو الموضوعات الرئيسية هنا..."
                          : "Paste major chapters, modules, or key topics here..."
                      }
                      className="ui-textarea"
                    />
                  </label>
                  <div className="wizard-step-actions">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setStep(1)}
                      leftIcon={!ar ? (ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />) : undefined}
                      rightIcon={ar ? (ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />) : undefined}
                    >
                      {ar ? "رجوع" : "Back"}
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => setStep(3)} 
                      disabled={!syllabusText.trim()}
                      rightIcon={!ar ? <NavArrow className="w-4 h-4" /> : undefined}
                      leftIcon={ar ? <NavArrow className="w-4 h-4" /> : undefined}
                    >
                      {ar ? "التالي" : "Next"}
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="wizard-step-content">
                  <div className="ui-card ui-card-content" style={{ background: 'var(--surface-sunken)', marginBottom: 'var(--space-4)' }}>
                    <h3 style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-heading)' }}>
                      {ar ? "ملخص الامتحان" : "Exam Summary"}
                    </h3>
                    <p style={{ marginBottom: 'var(--space-1)' }}><strong>{ar ? "المادة:" : "Course:"}</strong> {title}</p>
                    <p style={{ marginBottom: 'var(--space-1)' }}><strong>{ar ? "الموعد:" : "Date:"}</strong> {examAt}</p>
                    <p><strong>{ar ? "الموضوعات:" : "Topics:"}</strong> {syllabusText.split('\n').filter(l => l.trim()).length} {ar ? "أسطر" : "lines"}</p>
                  </div>
                  
                  {message && (
                    <p className="form-error" role="alert">
                      {message}
                    </p>
                  )}
                  
                  <div className="wizard-step-actions">
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={() => setStep(2)}
                      leftIcon={!ar ? (ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />) : undefined}
                      rightIcon={ar ? (ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />) : undefined}
                    >
                      {ar ? "رجوع" : "Back"}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      isLoading={pending}
                      leftIcon={<Sparkles className="w-4 h-4" />}
                      onClick={() => {
                        const fd = new FormData();
                        fd.append("title", title);
                        fd.append("examAt", examAt);
                        fd.append("syllabusText", syllabusText);
                        generate(fd);
                      }}
                    >
                      {ar ? "توليد مقترح الخطة" : "Generate plan proposal"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
