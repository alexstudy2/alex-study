"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  CalendarRange,
  Clock3,
  Flame,
  Focus,
  Gauge,
  Hourglass,
  Lightbulb,
  ListChecks,
  Minus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { AnalyticsData } from "@/lib/analytics/aggregate";
import { ANALYTICS_RANGES } from "@/lib/analytics/window";
import { EcgTrace, MedicalGlyph } from "@/components/ui/medical-doodles";
import { CalendarHeatmap, WeekHourHeatmap } from "./analytics-heatmaps";
import {
  FocusQualityChart,
  PlanAccuracyChart,
  SessionLengthChart,
  SubjectDonut,
  TrendChart,
  WeekdayRhythmChart,
} from "./analytics-panels";
import {
  changeFrom,
  formatDayLabel,
  formatHour,
  formatMinutes,
  subjectVar,
  weekdayLabels,
  type Direction,
} from "./analytics-format";

/**
 * Typed off the server aggregate rather than mirrored by hand.
 *
 * The hand-written mirror this replaces had to be edited in step with every field added to
 * `summarise()`, and a `type` that merely *compiles* against a wider object is not a type that
 * catches a renamed field -- it just stops seeing it. A type-only import is erased at build, so
 * nothing from `aggregate.ts` (and therefore nothing from Prisma) reaches the client bundle.
 *
 * `from`/`to` are dropped because they are the one place the two representations genuinely differ:
 * Dates survive the initial RSC prop boundary but arrive as ISO strings through `fetch().json()`,
 * and this view reads neither.
 */
type ViewData = Omit<AnalyticsData, "from" | "to">;

type Subject = { id: string; name: string; colorToken: string };

/** Sortable columns of the course deep-dive, in the order the chips appear. */
const COURSE_SORTS = ["minutes", "sessions", "avgSessionMinutes", "tasksCompleted", "avgFocusScore"] as const;
type CourseSort = (typeof COURSE_SORTS)[number];

/** The average session length that *was planned*, which is what the actual lengths are judged against. */
function plannedAverageOf(summary: ViewData["summary"]) {
  return summary.sessionCount ? Math.round(summary.plannedMinutes / summary.sessionCount) : 0;
}

/**
 * Share of the plan that was actually done.
 *
 * Not clamped to 100. The previous version of this card capped it, which meant a card reading
 * "100%" sat above a chart with bars at 150% -- two different answers to one question on one
 * screen. Overrunning the plan is information, so both now report it.
 */
function planAccuracyOf(summary: ViewData["summary"]) {
  return summary.plannedMinutes ? Math.round((summary.studyMinutes / summary.plannedMinutes) * 100) : 0;
}

export function AnalyticsView({
  initialData,
  locale,
  subjects,
  weekStartsOn,
}: {
  initialData: ViewData;
  locale: "en" | "ar";
  subjects: Subject[];
  /** 0 = Sunday. Drives the heatmap row order and the weekday chart's axis. */
  weekStartsOn: number;
}) {
  const [data, setData] = useState(initialData);
  const [range, setRange] = useState(String(initialData.days));
  const [subjectId, setSubjectId] = useState("");
  const [courseSort, setCourseSort] = useState<CourseSort>("minutes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ar = locale === "ar";
  /* The CTA's arrow follows the reading direction rather than being a fixed glyph -- a right arrow
     in an RTL layout points back at the page you came from. Same pattern as the dashboard header. */
  const NavArrow = ar ? ArrowLeft : ArrowRight;

  /* Both controls call this with explicit values rather than reading state: setState is async, so
     `refresh()` after `setRange(v)` would send the *previous* range on every change. */
  async function refresh(days: string, subject: string) {
    setBusy(true);
    setError("");
    const params = new URLSearchParams({ days });
    if (subject) params.set("subjectId", subject);
    /* `days`, not a from/to pair computed here. The boundary has to be Cairo midnight to line up
       with the aggregate's day buckets, and the browser does not know that -- computing it client
       side is how the first column of every chart ended up being a partial day. */
    const response = await fetch(`/api/analytics/summary?${params.toString()}`).catch(() => null);
    if (response?.ok) setData((await response.json()) as ViewData);
    else setError(ar ? "تعذر تحديث التحليلات." : "Could not update analytics.");
    setBusy(false);
  }

  const signals = useMemo(() => buildSignals(data, locale), [data, locale]);
  const activeDays = data.daily.filter((day) => day.minutes > 0).length;
  const plannedAverage = plannedAverageOf(data.summary);
  const dailyChart = useMemo(
    () => data.daily.map((day) => ({ ...day, label: formatDayLabel(day.date, locale) })),
    [data.daily, locale],
  );
  const courses = useMemo(
    () =>
      [...data.bySubject].sort((a, b) => {
        /* Nulls last whichever way we sort: an unscored course is not the *worst* focus score, it
           is an absence of one, and floating it to the top of a descending sort would read as a
           result. */
        const left = a[courseSort];
        const right = b[courseSort];
        if (left == null) return 1;
        if (right == null) return -1;
        return right - left || a.name.localeCompare(b.name);
      }),
    [data.bySubject, courseSort],
  );

  const filtered = subjects.find((subject) => subject.id === subjectId);
  const nothingRecorded =
    data.summary.sessionCount === 0 &&
    data.summary.tasksDue === 0 &&
    data.summary.tasksCompleted === 0;

  /* A blank account gets the whole page replaced -- with nothing recorded anywhere, a range picker
     and eight empty frames are just furniture. A blank *course* keeps the toolbar, because the way
     out of that state is to clear the filter, and the state is reached by setting it. */
  if (nothingRecorded && !subjectId) {
    return (
      <section className="analytics-view analytics-empty" dir={ar ? "rtl" : "ltr"}>
        <div className="empty-scene" aria-hidden="true">
          <BarChart3 className="empty-scene-glyph" />
          <EcgTrace className="empty-scene-ecg" variant="flatline" />
          <span className="empty-stamp">{ar ? "بانتظار البيانات" : "No readings"}</span>
        </div>
        <h2>{ar ? "لا توجد بيانات بعد" : "Nothing to chart yet"}</h2>
        <p>
          {ar
            ? "أول جلسة تركيز هي أول نقطة على الرسم. ابدأ بجلسة قصيرة وستظهر أنماطك هنا."
            : "Your first focus session is the first point on the chart. Run a short one and the patterns start here."}
        </p>
        <Link href="/focus" className="primary-button">
          {ar ? "ابدأ جلسة" : "Start a session"}
        </Link>
      </section>
    );
  }

  return (
    <section className="analytics-workspace" dir={ar ? "rtl" : "ltr"} aria-busy={busy}>
      <aside className="analytics-sidebar" aria-label={ar ? "أقسام التحليلات" : "Analytics sections"}>
        <div className="analytics-sidebar-title">
          <Gauge aria-hidden="true" />
          <span>{ar ? "لوحة التحليل" : "Analysis board"}</span>
        </div>
        <nav>
          <a href="#overview">
            <BarChart3 aria-hidden="true" />
            {ar ? "نظرة عامة" : "Overview"}
          </a>
          <a href="#trends">
            <TrendingUp aria-hidden="true" />
            {ar ? "الاتجاهات" : "Trends"}
          </a>
          <a href="#consistency">
            <CalendarCheck aria-hidden="true" />
            {ar ? "الانتظام" : "Consistency"}
          </a>
          <a href="#subjects">
            <BookOpen aria-hidden="true" />
            {ar ? "المواد" : "Subjects"}
          </a>
          <a href="#focus-patterns">
            <Clock3 aria-hidden="true" />
            {ar ? "أوقات التركيز" : "Focus times"}
          </a>
          <a href="#focus-quality">
            <Focus aria-hidden="true" />
            {ar ? "جودة التركيز" : "Focus quality"}
          </a>
          <a href="#ai-analysis">
            <BrainCircuit aria-hidden="true" />
            {ar ? "تحليل AI" : "AI analysis"}
          </a>
        </nav>
        <div className="analytics-sidebar-note">
          <Sparkles aria-hidden="true" />
          <strong>{ar ? "تحليل شخصي" : "Personal analysis"}</strong>
          <span>{ar ? "مبني فقط على جلساتك ومهامك." : "Grounded only in your sessions and tasks."}</span>
        </div>
        <Link className="secondary-button" href="/insights">
          <Lightbulb aria-hidden="true" />
          {ar ? "افتح الرؤى" : "Open insights"}
        </Link>
      </aside>

      <div className="analytics-main">
        <div className="analytics-toolbar" id="overview">
          <div>
            <p className="eyebrow">{ar ? "آخر تحديث" : "Live study data"}</p>
            <strong>
              {filtered
                ? filtered.name
                : ar
                  ? `${range} يومًا`
                  : `Last ${range} days`}
            </strong>
          </div>
          <div className="analytics-toolbar-controls">
            <label>
              <CalendarRange aria-hidden="true" />
              <span className="sr-only">{ar ? "الفترة" : "Range"}</span>
              <select
                value={range}
                onChange={(event) => {
                  setRange(event.target.value);
                  void refresh(event.target.value, subjectId);
                }}
                disabled={busy}
              >
                {ANALYTICS_RANGES.map((days) => (
                  <option key={days} value={days}>
                    {ar ? `${days} يومًا` : `${days} days`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <BookOpen aria-hidden="true" />
              <span className="sr-only">{ar ? "المادة" : "Course"}</span>
              <select
                value={subjectId}
                onChange={(event) => {
                  setSubjectId(event.target.value);
                  void refresh(range, event.target.value);
                }}
                disabled={busy}
              >
                <option value="">{ar ? "كل المواد" : "All courses"}</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {busy && (
            <span className="analytics-updating" role="status">
              <RefreshCw className="spin" aria-hidden="true" />
              {ar ? "تحديث" : "Updating"}
            </span>
          )}
        </div>
        {error && (
          <p className="insight-alert" role="alert">
            {error}
          </p>
        )}

        {nothingRecorded ? (
          /* Distinct from the blank-account state above, and deliberately so: "no data yet" on an
             account with a term's worth of sessions reads as data loss. */
          <section className="analytics-panel analytics-empty">
            <div className="empty-scene" aria-hidden="true">
              <MedicalGlyph seed={subjectId} className="empty-scene-glyph" />
              <EcgTrace className="empty-scene-ecg" variant="flatline" />
            </div>
            <h2>{ar ? "لا شيء لهذه المادة" : "Nothing for this course"}</h2>
            <p>
              {ar
                ? `لا توجد جلسات أو مهام مسجلة لـ ${filtered?.name ?? ""} خلال هذه الفترة. جرّب فترة أطول أو اختر "كل المواد".`
                : `No sessions or tasks recorded for ${filtered?.name ?? "this course"} in this range. Try a longer range, or switch back to all courses.`}
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setSubjectId("");
                void refresh(range, "");
              }}
            >
              {ar ? "كل المواد" : "All courses"}
            </button>
          </section>
        ) : (
          <>
            <div className="analytics-summary">
              <Metric
                icon={<Clock3 />}
                label={ar ? "وقت الدراسة" : "Study time"}
                value={formatMinutes(data.summary.studyMinutes, ar)}
                note={ar ? `${activeDays} أيام نشطة` : `${activeDays} active days`}
                /* Totals compare as a percentage; rates and scores compare in points below. */
                change={changeFrom(data.summary.studyMinutes, data.previous.studyMinutes)}
                unit="%"
                ar={ar}
              />
              <Metric
                icon={<Target />}
                label={ar ? "دقة الخطة" : "Plan accuracy"}
                value={`${planAccuracyOf(data.summary)}%`}
                note={
                  ar
                    ? `${formatMinutes(data.summary.plannedMinutes, ar)} مخطط`
                    : `${formatMinutes(data.summary.plannedMinutes, ar)} planned`
                }
                change={changeFrom(planAccuracyOf(data.summary), planAccuracyOf(data.previous), "points")}
                unit="pts"
                ar={ar}
              />
              <Metric
                icon={<ListChecks />}
                label={ar ? "إنجاز المهام" : "Task completion"}
                /* "—" rather than 0% when nothing was due: the rate is null in that case, because a
                   week with nothing scheduled has no completion rate to report. */
                value={data.summary.completionRate == null ? "—" : `${data.summary.completionRate}%`}
                /* The fraction the percentage is actually made of, plus the total finished, which is
                   usually the larger number -- tasks with no due date, and ones carried over from
                   an earlier week, count as done without ever having been due in this window. */
                note={
                  data.summary.tasksDue
                    ? ar
                      ? `${data.summary.tasksDueCompleted}/${data.summary.tasksDue} مستحقة · ${data.summary.tasksCompleted} منجزة`
                      : `${data.summary.tasksDueCompleted}/${data.summary.tasksDue} due · ${data.summary.tasksCompleted} done`
                    : ar
                      ? `${data.summary.tasksCompleted} منجزة · لا مهام مستحقة`
                      : `${data.summary.tasksCompleted} done · none were due`
                }
                change={changeFrom(data.summary.completionRate, data.previous.completionRate, "points")}
                unit="pts"
                ar={ar}
              />
              <Metric
                icon={<Focus />}
                label={ar ? "جودة التركيز" : "Focus quality"}
                /* Out of 100, not 10. `focusScore()` in lib/sessions/timer.ts builds this out of
                   60 points of plan adherence plus 40 of distraction-freedom and clamps at 100 --
                   /sessions and /insights have always read it that way, and this card was the only
                   place printing a 73.6 as "73.6/10". */
                value={
                  data.summary.averageFocusScore == null
                    ? "—"
                    : `${data.summary.averageFocusScore}/100`
                }
                note={ar ? `${data.summary.distractionCount} مشتتات` : `${data.summary.distractionCount} distractions`}
                change={changeFrom(data.summary.averageFocusScore, data.previous.averageFocusScore, "points")}
                unit="pts"
                ar={ar}
              />
            </div>

            <section className="analytics-panel analytics-wide-panel" id="trends">
              <PanelHeading
                icon={<TrendingUp />}
                title={ar ? "إيقاع الدراسة" : "Study rhythm"}
                copy={ar ? "الوقت الفعلي مقارنة بالوقت المخطط لكل يوم." : "Actual time compared with your daily plan."}
              />
              <TrendChart daily={dailyChart} ar={ar} />
            </section>

            <section className="analytics-panel analytics-wide-panel" id="consistency">
              <PanelHeading
                icon={<CalendarCheck />}
                title={ar ? "الحضور اليومي" : "Showing up"}
                copy={
                  ar
                    ? "كل مربع يوم واحد. الأغمق يعني وقتًا أطول."
                    : "One square per day — darker means longer."
                }
              />
              <div className="analytics-consistency">
                <div className="analytics-calendar-wrap">
                  <CalendarHeatmap daily={data.daily} weekStartsOn={weekStartsOn} locale={locale} />
                  <div className="analytics-heat-legend" aria-hidden="true">
                    <span>{ar ? "أقل" : "Less"}</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                      <i key={level} data-level={level} />
                    ))}
                    <span>{ar ? "أكثر" : "More"}</span>
                  </div>
                </div>
                <div className="analytics-streaks">
                  <Streak
                    icon={<Flame />}
                    value={String(data.summary.currentStreak)}
                    label={ar ? "أيام متتابعة الآن" : "day streak now"}
                  />
                  <Streak
                    icon={<CalendarCheck />}
                    value={String(data.summary.longestStreak)}
                    label={ar ? "أطول تتابع" : "longest run"}
                  />
                  <Streak
                    icon={<Hourglass />}
                    value={formatMinutes(data.summary.studyMinutes, ar)}
                    label={ar ? "إجمالي مسجل" : "banked in total"}
                  />
                </div>
              </div>
              <div className="analytics-split">
                <div>
                  <SubHeading
                    title={ar ? "إيقاع الأسبوع" : "Your week"}
                    copy={ar ? "الدقائق حسب يوم الأسبوع." : "Minutes by day of the week."}
                  />
                  <WeekdayRhythmChart
                    byWeekday={data.byWeekday}
                    weekStartsOn={weekStartsOn}
                    locale={locale}
                  />
                </div>
                <div>
                  <SubHeading
                    title={ar ? "طول الجلسة" : "Session length"}
                    copy={
                      ar
                        ? `متوسطك ${formatMinutes(data.summary.avgSessionMinutes, ar)} مقابل ${formatMinutes(plannedAverage, ar)} مخطط.`
                        : `You average ${formatMinutes(data.summary.avgSessionMinutes, ar)} against a ${formatMinutes(plannedAverage, ar)} plan.`
                    }
                  />
                  <SessionLengthChart
                    buckets={data.sessionLengths}
                    plannedAverage={plannedAverage}
                    ar={ar}
                  />
                </div>
              </div>
            </section>

            <section className="analytics-panel analytics-wide-panel" id="subjects">
              <PanelHeading
                icon={<BookOpen />}
                title={ar ? "توزيع المواد" : "Subject mix"}
                copy={ar ? "أين يذهب وقت الدراسة، ومادة بمادة." : "Where the time goes, course by course."}
              />
              <div className="analytics-course-layout">
                <div>
                  <SubjectDonut
                    subjects={data.bySubject}
                    total={data.summary.studyMinutes}
                    ar={ar}
                  />
                  <div className="analytics-legend">
                    {data.bySubject.map((subject) => (
                      <div key={subject.id}>
                        <i style={{ background: subjectVar(subject.colorToken) }} />
                        <span>{subject.name}</span>
                        <strong>{formatMinutes(subject.minutes, ar)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="analytics-course-detail">
                  <div className="analytics-sort" role="group" aria-label={ar ? "ترتيب المواد" : "Sort courses"}>
                    {COURSE_SORTS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={courseSort === key}
                        onClick={() => setCourseSort(key)}
                      >
                        {courseSortLabel(key, ar)}
                      </button>
                    ))}
                  </div>
                  <div className="analytics-course-grid">
                    {courses.map((course) => (
                      /* data-color, not an inline colour: `[data-color="teal"] { --subject-color:
                         var(--subject-teal) }` already exists in the stylesheet, so the card picks
                         up the same ink this course has on the pinboard and the dashboard. */
                      <article key={course.id} data-color={course.colorToken.toLowerCase()}>
                        <header>
                          <MedicalGlyph seed={course.id} />
                          <h3>{course.name}</h3>
                        </header>
                        <dl>
                          <Stat
                            label={ar ? "الوقت" : "Time"}
                            value={formatMinutes(course.minutes, ar)}
                          />
                          <Stat
                            label={ar ? "جلسات" : "Sessions"}
                            value={String(course.sessions)}
                          />
                          <Stat
                            label={ar ? "متوسط الجلسة" : "Avg length"}
                            value={course.sessions ? formatMinutes(course.avgSessionMinutes, ar) : "—"}
                          />
                          <Stat
                            label={ar ? "مهام مكتملة" : "Tasks done"}
                            value={String(course.tasksCompleted)}
                          />
                          <Stat
                            label={ar ? "التركيز" : "Focus"}
                            value={course.avgFocusScore == null ? "—" : `${course.avgFocusScore}/100`}
                          />
                          <Stat
                            label={ar ? "تشتت/ساعة" : "Distr./hr"}
                            value={course.minutes ? String(course.distractionsPerHour) : "—"}
                          />
                        </dl>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="analytics-panel analytics-wide-panel" id="focus-patterns">
              <PanelHeading
                icon={<Clock3 />}
                title={ar ? "متى تركّز أفضل" : "When you focus best"}
                copy={
                  ar
                    ? "الدقائق حسب اليوم والساعة. الفراغات مهمة كالمربعات الممتلئة."
                    : "Minutes by day and hour — the gaps say as much as the squares."
                }
              />
              <div className="analytics-hourmap-wrap">
                <WeekHourHeatmap
                  matrix={data.byWeekdayHour}
                  weekStartsOn={weekStartsOn}
                  locale={locale}
                />
              </div>
            </section>

            <section className="analytics-panel analytics-wide-panel" id="focus-quality">
              <PanelHeading
                icon={<Focus />}
                title={ar ? "جودة التركيز" : "Focus quality"}
                copy={
                  ar
                    ? "درجة التركيز اليومية مع عدد المشتتات، ومدى قربك من خطتك."
                    : "Daily focus score against distraction counts, and how close you ran to plan."
                }
              />
              <div className="analytics-split">
                <div>
                  <SubHeading
                    title={ar ? "التركيز والمشتتات" : "Focus vs distractions"}
                    copy={ar ? "الخط هو الدرجة، الأعمدة هي المشتتات." : "The line is the score, the bars are distractions."}
                  />
                  <FocusQualityChart daily={dailyChart} ar={ar} />
                </div>
                <div>
                  <SubHeading
                    title={ar ? "دقة الخطة يوميًا" : "Plan accuracy by day"}
                    copy={ar ? "الخط المتقطع هو 100% من خطة اليوم." : "The dashed line is 100% of that day's plan."}
                  />
                  <PlanAccuracyChart daily={dailyChart} ar={ar} />
                </div>
              </div>
            </section>

            <section className="analytics-ai-panel" id="ai-analysis">
              <div className="analytics-ai-heading">
                <div>
                  <span className="analytics-ai-icon">
                    <BrainCircuit aria-hidden="true" />
                  </span>
                  <div>
                    <p className="eyebrow">AI · {ar ? "تحليل الأنماط" : "pattern analysis"}</p>
                    <h2>{ar ? "ماذا تقول بياناتك؟" : "What your data is saying"}</h2>
                    {/* Says what the panel is before the grid does: six readings, and the window
                        they were read from. Without it the header jumps straight from a title to a
                        wall of numbers whose range the reader has to infer from the toolbar. */}
                    <p className="analytics-ai-sub">
                      {ar
                        ? `${signals.length} قراءات من آخر ${data.days} يومًا.`
                        : `${signals.length} readings from the last ${data.days} days.`}
                    </p>
                  </div>
                </div>
                <Link href="/insights" className="secondary-button">
                  <Sparkles aria-hidden="true" />
                  {ar ? "رؤى أعمق" : "Deeper insights"}
                  <NavArrow aria-hidden="true" />
                </Link>
              </div>
              <div className="analytics-signal-grid">
                {signals.map((signal) => (
                  <article key={signal.label} data-tone={signal.tone}>
                    <signal.icon aria-hidden="true" />
                    <div>
                      <span>{signal.label}</span>
                      <strong>{signal.title}</strong>
                      <p>{signal.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="analytics-ai-disclaimer">
                {ar
                  ? "هذه إشارات وصفية من بياناتك وليست حكمًا على أدائك."
                  : "These are descriptive signals from your data, not a judgment of your performance."}
              </p>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  change,
  unit,
  ar,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  change: { direction: Direction; value: number | null };
  unit: "%" | "pts";
  ar: boolean;
}) {
  return (
    <article>
      <div className="analytics-metric-head">
        <div className="analytics-metric-icon">{icon}</div>
        <Delta change={change} unit={unit} ar={ar} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

/**
 * The change against the previous equal-length period.
 *
 * Green for up, grey for everything else -- never red. The header of this page says "notice the
 * pattern, not the pressure", and a red badge on a quiet week is exactly the pressure it promises
 * not to apply. The direction is also written out for screen readers, so it is never carried by
 * colour alone.
 */
function Delta({
  change,
  unit,
  ar,
}: {
  change: { direction: Direction; value: number | null };
  unit: "%" | "pts";
  ar: boolean;
}) {
  /* No previous figure at all -- a first-ever range, or a score nobody has recorded either side of
     the boundary. A "0%" here would be a claim, so say nothing. */
  if (change.direction === "flat" && change.value == null) return null;

  const Icon =
    change.direction === "up" ? TrendingUp : change.direction === "down" ? TrendingDown : Minus;
  const words =
    change.direction === "up"
      ? ar
        ? "أعلى من الفترة السابقة"
        : "up on the previous period"
      : change.direction === "down"
        ? ar
          ? "أقل من الفترة السابقة"
          : "down on the previous period"
        : ar
          ? "بلا تغيير"
          : "unchanged from the previous period";

  return (
    <span className="analytics-delta" data-direction={change.direction}>
      <Icon aria-hidden="true" />
      <span aria-hidden="true">
        {change.direction === "flat"
          ? "—"
          : change.value == null
            ? ar
              ? "جديد"
              : "new"
            : unit === "pts"
              ? ar
                ? `${change.value} نقطة`
                : `${change.value} pts`
              : `${change.value}%`}
      </span>
      <span className="sr-only">{words}</span>
    </span>
  );
}

function PanelHeading({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <header className="analytics-panel-heading">
      <div>
        {icon}
        <div>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
      </div>
    </header>
  );
}

/** The heading for one half of a split panel -- an h3, so the document outline stays in order. */
function SubHeading({ title, copy }: { title: string; copy: string }) {
  return (
    <header className="analytics-subheading">
      <h3>{title}</h3>
      <p>{copy}</p>
    </header>
  );
}

function Streak({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="analytics-streak">
      <span className="analytics-streak-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function courseSortLabel(key: CourseSort, ar: boolean) {
  if (key === "minutes") return ar ? "الوقت" : "Time";
  if (key === "sessions") return ar ? "جلسات" : "Sessions";
  if (key === "avgSessionMinutes") return ar ? "الطول" : "Length";
  if (key === "tasksCompleted") return ar ? "المهام" : "Tasks";
  return ar ? "التركيز" : "Focus";
}

/**
 * Six descriptive readings of the range. Descriptive is the operative word: every one of these is
 * arithmetic on the numbers already on the page, which is why the panel's own disclaimer can
 * honestly say it is not a judgment. Nothing here calls a model -- /insights is the page that
 * renders real AI rows.
 */
function buildSignals(data: ViewData, locale: "en" | "ar") {
  const ar = locale === "ar";
  const labels = weekdayLabels(locale);
  const bestHour = [...data.byHour].sort((a, b) => b.minutes - a.minutes)[0];
  const bestDay = [...data.byWeekday].sort((a, b) => b.minutes - a.minutes)[0];
  const activeDays = data.daily.filter((day) => day.minutes > 0).length;
  const consistency = Math.round((activeDays / Math.max(1, data.daily.length)) * 100);
  const recent = data.daily.slice(-7).reduce((total, day) => total + day.minutes, 0);
  const earlier = data.daily.slice(-14, -7).reduce((total, day) => total + day.minutes, 0);
  const direction = earlier ? Math.round(((recent - earlier) / earlier) * 100) : 0;
  const distractionRate =
    Math.round((data.summary.distractionCount / Math.max(1, data.summary.studyMinutes)) * 60 * 10) / 10;
  const plannedAverage = plannedAverageOf(data.summary);
  const actualAverage = data.summary.avgSessionMinutes;
  /* Within a tenth of the planned length counts as on target. An exact match is not a thing that
     happens, and calling a 44-minute run against a 45-minute plan a miss would be noise. */
  const onLength = plannedAverage > 0 && Math.abs(actualAverage - plannedAverage) <= plannedAverage * 0.1;

  return [
    {
      icon: Clock3,
      tone: "blue",
      label: ar ? "نافذة التركيز" : "Focus window",
      title: bestHour ? formatHour(bestHour.hour) : "—",
      copy: ar
        ? "الساعة التي تراكم فيها أكبر وقت دراسة."
        : "The hour where you accumulated the most study time.",
    },
    {
      icon: CalendarCheck,
      tone: "blue",
      label: ar ? "أفضل يوم" : "Best day",
      title: bestDay && bestDay.minutes > 0 ? labels[bestDay.weekday] : "—",
      copy:
        bestDay && bestDay.minutes > 0
          ? ar
            ? `${formatMinutes(bestDay.minutes, ar)} خلال ${bestDay.sessions} جلسات في هذه الفترة.`
            : `${formatMinutes(bestDay.minutes, ar)} across ${bestDay.sessions} sessions this range.`
          : ar
            ? "لا يوجد يوم بارز بعد."
            : "No standout day yet.",
    },
    {
      icon: Gauge,
      tone: consistency >= 60 ? "green" : "amber",
      label: ar ? "الاتساق" : "Consistency",
      title: `${consistency}%`,
      copy: ar
        ? `${activeDays} أيام نشطة خلال الفترة المحددة.`
        : `${activeDays} active days in the selected range.`,
    },
    {
      icon: Hourglass,
      tone: onLength ? "green" : "amber",
      label: ar ? "الجلسة المعتادة" : "Typical session",
      title: formatMinutes(actualAverage, ar),
      copy: plannedAverage
        ? ar
          ? `مقابل ${formatMinutes(plannedAverage, ar)} مخطط لكل جلسة.`
          : `Against a ${formatMinutes(plannedAverage, ar)} plan per session.`
        : ar
          ? "لم تحدد طولًا مخططًا بعد."
          : "No planned length recorded yet.",
    },
    {
      icon: TrendingUp,
      tone: direction >= 0 ? "green" : "amber",
      label: ar ? "اتجاه 7 أيام" : "7-day direction",
      title: `${direction > 0 ? "+" : ""}${direction}%`,
      copy: ar
        ? "مقارنة إجمالي الأسبوع الأخير بالأسبوع السابق."
        : "Last week's study time compared with the week before.",
    },
    {
      icon: Focus,
      tone: distractionRate <= 2 ? "green" : "amber",
      label: ar ? "كثافة التشتت" : "Distraction density",
      title: ar ? `${distractionRate} / ساعة` : `${distractionRate} / hour`,
      copy: ar
        ? "عدد المشتتات المسجلة لكل ساعة دراسة."
        : "Recorded distractions per study hour.",
    },
  ];
}
