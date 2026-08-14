"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
        ar ? "تعذر الاتصال بالخادم. حاول مرة أخرى." : "The server could not be reached. Try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="exam-plan-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="exam-plan-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "مخطط امتحان بالذكاء الاصطناعي" : "AI exam planner"}</p>
          <h1>{ar ? "ابدأ بمقترح قابل للتعديل." : "Start with an editable proposal."}</h1>
          <p>
            {ar
              ? "لن تتحول أي خطوة إلى مهمة قبل اختيارك وتأكيدك الصريح."
              : "No plan item becomes a task until you select it and explicitly confirm."}
          </p>
        </div>
        <nav aria-label={ar ? "تنقل مخطط الامتحان" : "Exam planner navigation"}>
          <Link href="/insights">{ar ? "الرؤى" : "Insights"}</Link>
          <Link href="/tasks">{ar ? "المهام" : "Tasks"}</Link>
        </nav>
      </header>

      <div className="exam-plan-create-layout">
        <section className="exam-plan-form-panel" aria-labelledby="exam-plan-form-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI · {ar ? "مقترح فقط" : "proposal only"}</p>
              <h2 id="exam-plan-form-title">{ar ? "بيانات الامتحان" : "Exam details"}</h2>
            </div>
          </div>
          {aiEnabled ? (
            <form action={generate} className="exam-plan-form">
              <label>
                {ar ? "اسم الخطة" : "Plan title"}
                <input
                  name="title"
                  required
                  maxLength={120}
                  placeholder={ar ? "مثال: مراجعة امتحان الجهاز العصبي" : "e.g. Neuro exam review"}
                />
              </label>
              <label>
                {ar ? "تاريخ الامتحان" : "Exam date"}
                <input name="examAt" type="date" required defaultValue={defaultExamDate()} />
              </label>
              <label>
                {ar ? "محتوى المنهج" : "Syllabus"}
                <textarea
                  name="syllabusText"
                  required
                  minLength={20}
                  maxLength={12_000}
                  rows={12}
                  placeholder={
                    ar
                      ? "اكتب الوحدات أو الموضوعات التي يجب تغطيتها."
                      : "List the units or topics that need coverage."
                  }
                />
              </label>
              <div className="exam-plan-disclosure">
                <strong>{ar ? "حدود واضحة" : "Clear boundary"}</strong>
                <span>
                  {ar
                    ? "يُحفظ المقترح للمراجعة، ويُحذف نص المنهج من سياق الذكاء الاصطناعي بعد 30 يومًا."
                    : "The proposal is saved for review; the syllabus text is purged from AI context after 30 days."}
                </span>
              </div>
              <button className="primary-button" disabled={pending}>
                {pending
                  ? ar
                    ? "جارٍ إنشاء المقترح…"
                    : "Creating proposal…"
                  : ar
                    ? "إنشاء مقترح"
                    : "Create proposal"}
              </button>
            </form>
          ) : (
            <div className="session-state">
              <h3>{ar ? "الرؤى الذكية متوقفة" : "AI insights are off"}</h3>
              <p>
                {ar
                  ? "فعّلها من صفحة الرؤى قبل إنشاء خطة امتحان."
                  : "Turn them on from Insights before generating an exam plan."}
              </p>
              <Link className="secondary-button" href="/insights">
                {ar ? "فتح الرؤى" : "Open insights"}
              </Link>
            </div>
          )}
          <p className="form-error" role="alert" aria-live="polite">
            {message}
          </p>
        </section>

        <aside className="recent-plans" aria-labelledby="recent-plans-title">
          <p className="eyebrow">{ar ? "المسودات الأخيرة" : "Recent proposals"}</p>
          <h2 id="recent-plans-title">{ar ? "خططك" : "Your plans"}</h2>
          {recentPlans.length ? (
            <div>
              {recentPlans.map((plan) => (
                <Link key={plan.id} href={`/exam-plans/${plan.id}`}>
                  <strong>{plan.title}</strong>
                  <span>
                    {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                      dateStyle: "medium",
                      timeZone: "Africa/Cairo",
                    }).format(new Date(plan.examAt))}
                  </span>
                  <small>{statusLabel(plan.status, ar)}</small>
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-copy">{ar ? "لا توجد خطط بعد." : "No plans yet."}</p>
          )}
        </aside>
      </div>
    </main>
  );
}

function errorMessage(error: string | undefined, ar: boolean) {
  const english: Record<string, string> = {
    ai_disabled: "AI insights are turned off.",
    ai_unavailable: "AI is unavailable right now.",
    ai_rate_limited: "You have reached today’s generation limit.",
    ai_budget_exhausted: "The shared AI token budget is temporarily exhausted.",
    ai_in_progress: "An identical proposal is already being generated.",
    exam_too_soon: "Choose an exam at least six hours from now.",
    exam_too_far: "Choose an exam within the next year.",
    invalid_request: "Check the title, exam date, and syllabus length.",
  };
  const arabic: Record<string, string> = {
    ai_disabled: "تم إيقاف الرؤى الذكية.",
    ai_unavailable: "خدمة الذكاء الاصطناعي غير متاحة حاليًا.",
    ai_rate_limited: "وصلت إلى حد الإنشاء اليومي.",
    ai_budget_exhausted: "تم استهلاك ميزانية الرموز المشتركة مؤقتًا.",
    ai_in_progress: "يتم بالفعل إنشاء مقترح مطابق.",
    exam_too_soon: "اختر امتحانًا بعد ست ساعات على الأقل.",
    exam_too_far: "اختر امتحانًا خلال السنة القادمة.",
    invalid_request: "راجع اسم الخطة وتاريخ الامتحان وطول المنهج.",
  };
  return (
    (ar ? arabic : english)[error ?? ""] ??
    (ar ? "تعذر إنشاء المقترح." : "The proposal could not be created.")
  );
}

function statusLabel(status: string, ar: boolean) {
  const english: Record<string, string> = {
    PROPOSED: "Proposal",
    PARTIALLY_ACCEPTED: "Partially accepted",
    ACCEPTED: "Accepted",
    REJECTED: "Rejected",
    GENERATING: "Generating",
  };
  const arabic: Record<string, string> = {
    PROPOSED: "مقترح",
    PARTIALLY_ACCEPTED: "مقبول جزئيًا",
    ACCEPTED: "مقبول",
    REJECTED: "مرفوض",
    GENERATING: "قيد الإنشاء",
  };
  return (ar ? arabic : english)[status] ?? status;
}
