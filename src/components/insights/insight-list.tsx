"use client";
import Link from "next/link";
import { useState } from "react";
import { BrainCircuit, Check, ChevronRight, Clock3, Lightbulb, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
type Insight = {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string | Date;
  model: string;
  supportingData?: unknown;
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
  const [dismissed, setDismissed] = useState<string | null>(null);
  const ar = locale === "ar";
  async function generate() {
    setBusy(true);
    setMessage("");
    const r = await fetch("/api/insights/daily-tip", { method: "POST" }).catch(() => null);
    const p = await r?.json().catch(() => null);
    if (r?.ok)
      setInsights((current) => [p.insight, ...current.filter((item) => item.id !== p.insight.id)]);
    else setMessage(insightError(p?.error, ar));
    setBusy(false);
  }
  async function dismiss(id: string) {
    setDismissed(id);
    const r = await fetch(`/api/insights/${id}/dismiss`, { method: "POST" }).catch(() => null);
    setDismissed(null);
    if (r?.ok) setInsights((current) => current.filter((x) => x.id !== id));
    else setMessage(ar ? "تعذر إخفاء الرؤية." : "Could not dismiss this insight.");
  }
  return (
    <section className="insight-workspace" dir={ar ? "rtl" : "ltr"} aria-busy={busy}>
      <div className="insight-status-strip">
        <div className="insight-status-icon"><BrainCircuit aria-hidden="true" /></div>
        <div>
          <strong>{enabled ? (ar ? "الرؤى مفعلة" : "Insights are on") : (ar ? "الرؤى متوقفة" : "Insights are off")}</strong>
          <span>{ar ? "ملاحظات اختيارية مبنية على نمط دراستك فقط" : "Optional notes grounded in your study rhythm only"}</span>
        </div>
        <span className={`insight-status-dot ${enabled ? "on" : "off"}`} aria-label={enabled ? "Enabled" : "Disabled"} />
      </div>
      <div className="insight-toolbar">
        <div>
          <p className="eyebrow"><Sparkles className="insight-eyebrow-icon" aria-hidden="true" /> AI · {ar ? "اختياري" : "optional"}</p>
          <h2>{ar ? "رؤى من بياناتك فقط" : "Insights from your data only"}</h2>
          <p>
            {ar
              ? "ملاحظات ذكية من بياناتك."
              : "Smart notes from your study data."}
          </p>
        </div>
        <div className="insight-actions">
          {enabled && (
            <button className="primary-button" disabled={busy} onClick={generate}>
              {busy ? <RefreshCw className="insight-button-icon spin" aria-hidden="true" /> : <Lightbulb className="insight-button-icon" aria-hidden="true" />}
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
            className="insight-toggle-button"
            disabled={busy}
            onClick={async () => {
              const next = !enabled;
              setBusy(true);
              const response = await fetch("/api/me/ai", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ enabled: next }),
              }).catch(() => null);
              setBusy(false);
              if (response?.ok) {
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
              } else setMessage(ar ? "تعذر تحديث إعداد الرؤى." : "Could not update the insights setting.");
            }}
          >
            {enabled ? <X className="insight-button-icon" aria-hidden="true" /> : <Check className="insight-button-icon" aria-hidden="true" />}
            {enabled ? (ar ? "إيقاف الرؤى" : "Turn off AI") : ar ? "تشغيل الرؤى" : "Turn on AI"}
          </button>
          <Link className="secondary-button" href="/exam-plans/new">
            <ChevronRight className="insight-button-icon" aria-hidden="true" />
            {ar ? "إنشاء خطة امتحان" : "Create exam plan"}
          </Link>
        </div>
      </div>
      {message && (
        <p className="insight-alert" role="alert">
          <ShieldCheck aria-hidden="true" />
          {message}
        </p>
      )}
      <div className="insight-list" aria-live="polite">
        {insights.length ? (
          insights.map((item) => {
            const supportingData = readSupportingData(item.supportingData);
            return (
            <article className="insight-card" key={item.id} data-type={item.type}>
              <div className="insight-card-topline">
                <p className="eyebrow"><span className="ai-label">AI</span> {insightTypeLabel(item.type, ar)}</p>
                <span className="insight-confidence"><ShieldCheck aria-hidden="true" /> {confidenceLabel(supportingData.confidence, ar)}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="insight-content">{item.content}</p>
              <div className="insight-card-context">
                <span><Clock3 aria-hidden="true" /> {supportingData.period ?? (ar ? "الفترة الأخيرة" : "Recent study rhythm")}</span>
                <span>{item.model ? "Tracked signal" : "Personal note"}</span>
              </div>
              <footer>
                <time>
                  {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                    dateStyle: "medium",
                    timeZone: "Africa/Cairo",
                  }).format(new Date(item.createdAt))}
                </time>
                <button className="insight-dismiss" disabled={dismissed === item.id} onClick={() => dismiss(item.id)}>
                  {dismissed === item.id ? <RefreshCw className="insight-button-icon spin" aria-hidden="true" /> : null}
                  {ar ? "تجاهل" : "Dismiss"}
                </button>
              </footer>
            </article>
            );
          })
        ) : (
          <div className="insight-empty-state">
            <div className="insight-empty-icon"><Lightbulb aria-hidden="true" /></div>
            <h3>{ar ? "لا توجد رؤى محفوظة" : "No saved insights"}</h3>
            <p>{ar ? "اطلب رؤية عندما تكون مستعدًا." : "Request one when you are ready."}</p>
            {enabled && <button className="secondary-button" disabled={busy} onClick={generate}><Lightbulb className="insight-button-icon" aria-hidden="true" />{ar ? "اطلب أول رؤية" : "Request your first insight"}</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function readSupportingData(value: unknown): { confidence?: string; period?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    confidence: typeof data.confidence === "string" ? data.confidence : undefined,
    period: typeof data.period === "string" ? data.period : undefined,
  };
}

function confidenceLabel(value: string | undefined, ar: boolean) {
  if (value === "strong") return ar ? "إشارة قوية" : "Strong signal";
  if (value === "moderate") return ar ? "إشارة متوسطة" : "Moderate signal";
  return ar ? "إشارة مبدئية" : "Early signal";
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
