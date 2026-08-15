"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarRange,
  Clock3,
  Focus,
  Gauge,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

type Data = {
  summary: {
    studyMinutes: number;
    plannedMinutes: number;
    tasksCompleted: number;
    tasksDue: number;
    distractionCount: number;
    averageFocusScore: number | null;
    completionRate: number;
  };
  daily: {
    date: string;
    minutes: number;
    plannedMinutes: number;
    tasksCompleted: number;
    distractions: number;
  }[];
  bySubject: { id: string; name: string; colorToken: string; minutes: number; sessions: number }[];
  byHour: { hour: number; minutes: number }[];
};

const chartColors = ["#49B6E5", "#263D5B", "#16A34A", "#D97706", "#DC2626", "#7C3AED"];

export function AnalyticsView({ initialData, locale }: { initialData: Data; locale: "en" | "ar" }) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ar = locale === "ar";

  async function change(value: string) {
    setRange(value);
    setBusy(true);
    setError("");
    const to = new Date();
    const from = new Date(to.getTime() - (Number(value) - 1) * 86400000);
    const response = await fetch(`/api/analytics/summary?from=${from.toISOString()}&to=${to.toISOString()}`).catch(() => null);
    if (response?.ok) setData(await response.json());
    else setError(ar ? "تعذر تحديث التحليلات." : "Could not update analytics.");
    setBusy(false);
  }

  const signals = useMemo(() => buildSignals(data, ar), [data, ar]);
  const activeDays = data.daily.filter((day) => day.minutes > 0).length;
  const planAccuracy = data.summary.plannedMinutes
    ? Math.min(100, Math.round((data.summary.studyMinutes / data.summary.plannedMinutes) * 100))
    : 0;
  const dailyChart = data.daily.map((day) => ({
    ...day,
    label: new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`)),
  }));

  if (data.summary.studyMinutes === 0 || !data.daily?.length) {
    return (
      <section className="analytics-view empty-state analytics-empty" dir={ar ? "rtl" : "ltr"}>
        <BarChart3 aria-hidden="true" />
        <h2>{ar ? "لا توجد بيانات بعد" : "No data yet"}</h2>
        <p>{ar ? "ابدأ أول جلسة تركيز لتظهر أنماطك هنا." : "Start a focus session to reveal your study patterns."}</p>
        <Link href="/focus" className="primary-button">{ar ? "ابدأ جلسة" : "Start a session"}</Link>
      </section>
    );
  }

  return (
    <section className="analytics-workspace" dir={ar ? "rtl" : "ltr"} aria-busy={busy}>
      <aside className="analytics-sidebar" aria-label={ar ? "أقسام التحليلات" : "Analytics sections"}>
        <div className="analytics-sidebar-title"><Gauge aria-hidden="true" /><span>{ar ? "لوحة التحليل" : "Analysis board"}</span></div>
        <nav>
          <a href="#overview"><BarChart3 aria-hidden="true" />{ar ? "نظرة عامة" : "Overview"}</a>
          <a href="#trends"><TrendingUp aria-hidden="true" />{ar ? "الاتجاهات" : "Trends"}</a>
          <a href="#subjects"><BookOpen aria-hidden="true" />{ar ? "المواد" : "Subjects"}</a>
          <a href="#focus-patterns"><Clock3 aria-hidden="true" />{ar ? "أوقات التركيز" : "Focus times"}</a>
          <a href="#ai-analysis"><BrainCircuit aria-hidden="true" />{ar ? "تحليل AI" : "AI analysis"}</a>
        </nav>
        <div className="analytics-sidebar-note">
          <Sparkles aria-hidden="true" />
          <strong>{ar ? "تحليل شخصي" : "Personal analysis"}</strong>
          <span>{ar ? "مبني فقط على جلساتك ومهامك." : "Grounded only in your sessions and tasks."}</span>
        </div>
        <Link className="secondary-button" href="/insights"><Lightbulb aria-hidden="true" />{ar ? "افتح الرؤى" : "Open insights"}</Link>
      </aside>

      <div className="analytics-main">
        <div className="analytics-toolbar" id="overview">
          <div><p className="eyebrow">{ar ? "آخر تحديث" : "Live study data"}</p><strong>{ar ? `${range} يومًا` : `Last ${range} days`}</strong></div>
          <label><CalendarRange aria-hidden="true" /><span className="sr-only">{ar ? "الفترة" : "Range"}</span>
            <select value={range} onChange={(event) => change(event.target.value)} disabled={busy}>
              <option value="7">{ar ? "7 أيام" : "7 days"}</option>
              <option value="30">{ar ? "30 يومًا" : "30 days"}</option>
              <option value="90">{ar ? "90 يومًا" : "90 days"}</option>
            </select>
          </label>
          {busy && <span className="analytics-updating" role="status"><RefreshCw className="spin" aria-hidden="true" />{ar ? "تحديث" : "Updating"}</span>}
        </div>
        {error && <p className="insight-alert" role="alert">{error}</p>}

        <div className="analytics-summary">
          <Metric icon={<Clock3 />} label={ar ? "وقت الدراسة" : "Study time"} value={formatMinutes(data.summary.studyMinutes, ar)} note={ar ? `${activeDays} أيام نشطة` : `${activeDays} active days`} />
          <Metric icon={<Target />} label={ar ? "دقة الخطة" : "Plan accuracy"} value={`${planAccuracy}%`} note={ar ? `${formatMinutes(data.summary.plannedMinutes, ar)} مخطط` : `${formatMinutes(data.summary.plannedMinutes, ar)} planned`} />
          <Metric icon={<ListChecks />} label={ar ? "إنجاز المهام" : "Task completion"} value={`${data.summary.completionRate}%`} note={`${data.summary.tasksCompleted}/${data.summary.tasksDue}`} />
          <Metric icon={<Focus />} label={ar ? "جودة التركيز" : "Focus quality"} value={data.summary.averageFocusScore == null ? "—" : `${data.summary.averageFocusScore}/10`} note={ar ? `${data.summary.distractionCount} مشتتات` : `${data.summary.distractionCount} distractions`} />
        </div>

        <section className="analytics-panel analytics-wide-panel" id="trends">
          <PanelHeading icon={<TrendingUp />} title={ar ? "إيقاع الدراسة" : "Study rhythm"} copy={ar ? "الوقت الفعلي مقارنة بالوقت المخطط لكل يوم." : "Actual time compared with your daily plan."} />
          <div className="analytics-chart analytics-trend-chart" role="img" aria-label={ar ? "رسم اتجاه الدراسة" : "Study trend chart"}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChart} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}>
                <defs><linearGradient id="studyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#49B6E5" stopOpacity={0.45}/><stop offset="95%" stopColor="#49B6E5" stopOpacity={0.05}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="5 5" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="plannedMinutes" stroke="#263D5B" strokeDasharray="6 5" fill="transparent" name={ar ? "المخطط" : "Planned"} />
                <Area type="monotone" dataKey="minutes" stroke="#1689B8" strokeWidth={3} fill="url(#studyFill)" name={ar ? "الفعلي" : "Actual"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="analytics-chart-grid">
          <section className="analytics-panel" id="subjects">
            <PanelHeading icon={<BookOpen />} title={ar ? "توزيع المواد" : "Subject mix"} copy={ar ? "أين يذهب وقت الدراسة." : "Where your study time goes."} />
            <div className="analytics-chart analytics-donut-chart">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.bySubject} dataKey="minutes" nameKey="name" innerRadius="52%" outerRadius="78%" paddingAngle={3}>{data.bySubject.map((item, index) => <Cell key={item.id} fill={chartColors[index % chartColors.length]} stroke="#263D5B" strokeWidth={1.5} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
              <div className="analytics-donut-label"><strong>{formatMinutes(data.summary.studyMinutes, ar)}</strong><span>{ar ? "إجمالي" : "total"}</span></div>
            </div>
            <div className="analytics-legend">{data.bySubject.map((item, index) => <div key={item.id}><i style={{ background: chartColors[index % chartColors.length] }} /><span>{item.name}</span><strong>{formatMinutes(item.minutes, ar)}</strong></div>)}</div>
          </section>

          <section className="analytics-panel" id="focus-patterns">
            <PanelHeading icon={<Clock3 />} title={ar ? "خريطة ساعات التركيز" : "Focus time map"} copy={ar ? "إجمالي الدقائق حسب ساعة البداية." : "Minutes grouped by session start time."} />
            <div className="analytics-chart analytics-hour-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.byHour} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid strokeDasharray="5 5" stroke="var(--line)" vertical={false}/><XAxis dataKey="hour" tickFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} tick={{ fontSize: 10, fill: "var(--muted)" }} interval="preserveStartEnd"/><YAxis tick={{ fontSize: 11, fill: "var(--muted)" }}/><Tooltip contentStyle={tooltipStyle} labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} /><Bar dataKey="minutes" name={ar ? "دقائق" : "Minutes"} fill="#49B6E5" stroke="#263D5B" strokeWidth={1.5} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </section>
        </div>

        <section className="analytics-ai-panel" id="ai-analysis">
          <div className="analytics-ai-heading"><div><span className="analytics-ai-icon"><BrainCircuit aria-hidden="true" /></span><div><p className="eyebrow">AI · {ar ? "تحليل الأنماط" : "pattern analysis"}</p><h2>{ar ? "ماذا تقول بياناتك؟" : "What your data is saying"}</h2></div></div><Link href="/insights" className="secondary-button">{ar ? "رؤى أعمق" : "Deeper insights"}</Link></div>
          <div className="analytics-signal-grid">
            {signals.map((signal) => <article key={signal.title} data-tone={signal.tone}><signal.icon aria-hidden="true" /><div><span>{signal.label}</span><strong>{signal.title}</strong><p>{signal.copy}</p></div></article>)}
          </div>
          <p className="analytics-ai-disclaimer">{ar ? "هذه إشارات وصفية من بياناتك وليست حكمًا على أدائك." : "These are descriptive signals from your data, not a judgment of your performance."}</p>
        </section>
      </div>
    </section>
  );
}

function Metric({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return <article><div className="analytics-metric-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function PanelHeading({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <header className="analytics-panel-heading"><div>{icon}<div><h2>{title}</h2><p>{copy}</p></div></div></header>;
}

function formatMinutes(minutes: number, ar: boolean) {
  if (minutes < 60) return ar ? `${minutes} د` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? (ar ? `${hours}س ${rest}د` : `${hours}h ${rest}m`) : ar ? `${hours}س` : `${hours}h`;
}

function buildSignals(data: Data, ar: boolean) {
  const bestHour = [...data.byHour].sort((a, b) => b.minutes - a.minutes)[0];
  const activeDays = data.daily.filter((day) => day.minutes > 0).length;
  const consistency = Math.round((activeDays / Math.max(1, data.daily.length)) * 100);
  const recent = data.daily.slice(-7).reduce((sum, day) => sum + day.minutes, 0);
  const previous = data.daily.slice(-14, -7).reduce((sum, day) => sum + day.minutes, 0);
  const direction = previous ? Math.round(((recent - previous) / previous) * 100) : 0;
  const distractionRate = Math.round((data.summary.distractionCount / Math.max(1, data.summary.studyMinutes)) * 60 * 10) / 10;
  return [
    { icon: Clock3, tone: "blue", label: ar ? "نافذة التركيز" : "Focus window", title: bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "—", copy: ar ? "الساعة التي تراكم فيها أكبر وقت دراسة." : "The hour where you accumulated the most study time." },
    { icon: Gauge, tone: consistency >= 60 ? "green" : "amber", label: ar ? "الاتساق" : "Consistency", title: `${consistency}%`, copy: ar ? `${activeDays} أيام نشطة خلال الفترة المحددة.` : `${activeDays} active days in the selected range.` },
    { icon: TrendingUp, tone: direction >= 0 ? "green" : "amber", label: ar ? "اتجاه 7 أيام" : "7-day direction", title: `${direction > 0 ? "+" : ""}${direction}%`, copy: ar ? "مقارنة إجمالي الأسبوع الأخير بالأسبوع السابق." : "Last week's study time compared with the week before." },
    { icon: Focus, tone: distractionRate <= 2 ? "green" : "amber", label: ar ? "كثافة التشتت" : "Distraction density", title: ar ? `${distractionRate} / ساعة` : `${distractionRate} / hour`, copy: ar ? "عدد المشتتات المسجلة لكل ساعة دراسة." : "Recorded distractions per study hour." },
  ];
}

const tooltipStyle = { border: "2px solid #263D5B", borderRadius: "6px", boxShadow: "3px 3px 0 #263D5B", fontSize: "12px" };
