"use client";
import Link from "next/link";
import { useState } from "react";
type Insight = {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string | Date;
  model: string;
};
export function InsightList({
  initialInsights,
  locale,
  aiEnabled,
}: {
  initialInsights: Insight[];
  locale: "en" | "ar";
  aiEnabled: boolean;
}) {
  const [insights, setInsights] = useState(initialInsights);
  const [enabled, setEnabled] = useState(aiEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const ar = locale === "ar";
  async function generate() {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/insights/daily-tip", { method: "POST" });
    const p = await r.json();
    if (r.ok)
      setInsights((current) => [p.insight, ...current.filter((item) => item.id !== p.insight.id)]);
    else setMessage(insightError(p.error, ar));
    setBusy(false);
  }
  async function dismiss(id: string) {
    const r = await fetch(`/api/insights/${id}/dismiss`, { method: "POST" });
    if (r.ok) setInsights(insights.filter((x) => x.id !== id));
  }
  return (
    <section className="insight-workspace" dir={ar ? "rtl" : "ltr"}>
      <div className="insight-toolbar">
        <div>
          <p className="eyebrow">AI · {ar ? "اختياري" : "optional"}</p>
          <h2>{ar ? "رؤى من بياناتك فقط" : "Insights from your data only"}</h2>
          <p>
            {ar
              ? "لا تُستخدم هذه الرؤى في الترتيب أو التحديات، ويمكن تجاهلها في أي وقت."
              : "These insights never affect rankings or challenges, and can be dismissed at any time."}
          </p>
        </div>
        <div className="insight-actions">
          {enabled && (
            <button className="primary-button" disabled={busy} onClick={generate}>
              {busy
                ? ar
                  ? "جارٍ الإنشاء…"
                  : "Creating…"
                : ar
                  ? "اطلب رؤية"
                  : "Request an insight"}
            </button>
          )}
          <button
            className="secondary-button"
            disabled={busy}
            onClick={async () => {
              const next = !enabled;
              setBusy(true);
              const response = await fetch("/api/me/ai", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled: next }),
              });
              setBusy(false);
              if (response.ok) {
                setEnabled(next);
                setMessage(
                  next
                    ? ar
                      ? "تم تشغيل الرؤى الذكية."
                      : "AI insights are on."
                    : ar
                      ? "تم إيقاف الرؤى الذكية."
                      : "AI insights are off.",
                );
              }
            }}
          >
            {enabled ? (ar ? "إيقاف الرؤى" : "Turn off AI") : ar ? "تشغيل الرؤى" : "Turn on AI"}
          </button>
          <Link className="secondary-button" href="/exam-plans/new">
            {ar ? "إنشاء خطة امتحان" : "Create exam plan"}
          </Link>
        </div>
      </div>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <div className="insight-list">
        {insights.length ? (
          insights.map((item) => (
            <article key={item.id} data-type={item.type}>
              <span className="ai-label">AI</span>
              <p className="eyebrow">{insightTypeLabel(item.type, ar)}</p>
              <h3>{item.title}</h3>
              <p>{item.content}</p>
              <footer>
                <time>
                  {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                    dateStyle: "medium",
                    timeZone: "Africa/Cairo",
                  }).format(new Date(item.createdAt))}
                </time>
                <button onClick={() => dismiss(item.id)}>{ar ? "تجاهل" : "Dismiss"}</button>
              </footer>
            </article>
          ))
        ) : (
          <div className="session-state">
            <h3>{ar ? "لا توجد رؤى محفوظة" : "No saved insights"}</h3>
            <p>{ar ? "اطلب رؤية عندما تكون مستعدًا." : "Request one when you are ready."}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function insightTypeLabel(type: string, ar: boolean) {
  const english: Record<string, string> = {
    DAILY_TIP: "Daily tip",
    WEEKLY_RECAP: "Weekly recap",
    PERFORMANCE_DROP: "Pattern change",
    BURNOUT: "Workload check-in",
    BEST_TIME: "Observed best time",
  };
  const arabic: Record<string, string> = {
    DAILY_TIP: "نصيحة يومية",
    WEEKLY_RECAP: "ملخص أسبوعي",
    PERFORMANCE_DROP: "تغير في النمط",
    BURNOUT: "مراجعة عبء الدراسة",
    BEST_TIME: "أفضل وقت ملاحظ",
  };
  return (ar ? arabic : english)[type] ?? type.replaceAll("_", " ");
}

function insightError(code: string | undefined, ar: boolean) {
  const english: Record<string, string> = {
    ai_unavailable: "AI is unavailable right now.",
    ai_rate_limited: "You have reached today’s insight limit.",
    ai_budget_exhausted: "The shared AI token budget is temporarily exhausted.",
    ai_disabled: "AI insights are turned off.",
    ai_in_progress: "An insight is already being prepared.",
  };
  const arabic: Record<string, string> = {
    ai_unavailable: "خدمة الذكاء الاصطناعي غير متاحة حاليًا.",
    ai_rate_limited: "وصلت إلى حد الرؤى اليومي.",
    ai_budget_exhausted: "تم استهلاك ميزانية الرموز المشتركة مؤقتًا.",
    ai_disabled: "تم إيقاف الرؤى الذكية.",
    ai_in_progress: "يتم بالفعل إعداد رؤية.",
  };
  return (
    (ar ? arabic : english)[code ?? ""] ??
    (ar ? "تعذر إنشاء الرؤية." : "The insight could not be created.")
  );
}
