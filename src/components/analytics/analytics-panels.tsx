"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { formatMinutes, subjectVar, weekdayLabels, weekdayOrder } from "./analytics-format";

/**
 * The recharts half of /analytics: chart bodies only, no headings.
 *
 * Each panel on the page is a heading the view owns plus one of these, which keeps the view
 * readable as an outline of the page instead of 400 lines of chart props.
 *
 * Every colour here is a `var()` string rather than a hex literal. That works because SVG
 * presentation attributes are parsed as CSS values, so a custom property substitutes in `fill` and
 * `stroke` exactly as it would in a stylesheet -- the page already shipped `stroke="var(--line)"`
 * on its grid. It matters because the alternative, which is what this file replaces, was six
 * hardcoded hexes that painted #263D5B ink onto the #182234 card of the cosmic mood. Gradient
 * stops are the one exception: they take their colour from a class, so `stop-color` never has to
 * rely on attribute-level substitution.
 */

type Daily = {
  date: string;
  label: string;
  minutes: number;
  plannedMinutes: number;
  sessions: number;
  distractions: number;
  focusScore: number | null;
};

/** Shared axis dressing. Spread rather than copied so all six charts cannot drift apart. */
const axis = { tick: { fontSize: 11, fill: "var(--muted)" }, stroke: "var(--line)" } as const;
const grid = { strokeDasharray: "5 5", stroke: "var(--line)", vertical: false } as const;

/** Minutes vs. plan, per day. */
export function TrendChart({ daily, ar }: { daily: Daily[]; ar: boolean }) {
  return (
    <div
      className="analytics-chart analytics-trend-chart"
      role="img"
      aria-label={ar ? "رسم اتجاه الدراسة" : "Study trend chart"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={daily} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="analyticsStudyFill" x1="0" y1="0" x2="0" y2="1">
              <stop className="analytics-fill-top" offset="5%" />
              <stop className="analytics-fill-bottom" offset="95%" />
            </linearGradient>
          </defs>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} />
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(value) => formatMinutes(value, ar)}
                footer={(datum) =>
                  Number(datum.sessions) > 0
                    ? ar
                      ? `${datum.sessions} جلسات`
                      : `${datum.sessions} sessions`
                    : ar
                      ? "لا جلسات"
                      : "No sessions"
                }
              />
            }
          />
          {/* Planned first so the solid actual line draws over it, and dashed because a plan is a
              guess -- the same visual grammar the rest of the app uses for intent vs. record. */}
          <Area
            type="monotone"
            dataKey="plannedMinutes"
            stroke="var(--secondary)"
            strokeDasharray="6 5"
            fill="transparent"
            name={ar ? "المخطط" : "Planned"}
          />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="var(--primary-strong)"
            strokeWidth={3}
            fill="url(#analyticsStudyFill)"
            name={ar ? "الفعلي" : "Actual"}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Focus score as a line against distraction counts as bars.
 *
 * Two axes because the units are unrelated -- a score out of 100 and a count that rarely passes 30
 * -- and one axis would flatten the count into the floor. The score axis is pinned to `[0, 100]`,
 * which is the range `focusScore()` in lib/sessions/timer.ts actually clamps to, so the line's
 * height means the same thing in every range; letting recharts auto-fit it would rescale a good
 * week and a bad one to look identical.
 *
 * This is also the first place `daily[].distractions` is drawn at all: the aggregate has been
 * computing it since before this page existed and nothing ever read it.
 */
export function FocusQualityChart({ daily, ar }: { daily: Daily[]; ar: boolean }) {
  return (
    <div
      className="analytics-chart analytics-focus-chart"
      role="img"
      aria-label={ar ? "رسم جودة التركيز" : "Focus quality chart"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={daily} margin={{ top: 10, right: -18, left: -26, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis yAxisId="score" domain={[0, 100]} {...axis} />
          <YAxis yAxisId="count" orientation="right" allowDecimals={false} {...axis} />
          <Tooltip content={<ChartTooltip />} />
          <Bar
            yAxisId="count"
            dataKey="distractions"
            name={ar ? "مشتتات" : "Distractions"}
            fill="var(--warning-subtle)"
            stroke="var(--secondary)"
            strokeWidth={1.2}
            radius={[4, 4, 0, 0]}
          />
          {/* connectNulls, because an unscored day is a gap and not a zero -- the aggregate emits
              null for it precisely so the line can step over a rest day instead of diving to the
              axis and back. */}
          <Line
            yAxisId="score"
            type="monotone"
            dataKey="focusScore"
            name={ar ? "جودة التركيز" : "Focus score"}
            stroke="var(--primary-strong)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "var(--surface)", stroke: "var(--primary-strong)" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** How close each day came to its own plan, against a 100% line. */
export function PlanAccuracyChart({ daily, ar }: { daily: Daily[]; ar: boolean }) {
  const rows = daily.map((day) => ({
    label: day.label,
    /* null, not 0, on a day with no plan: nothing was promised, so nothing was missed. A zero bar
       would read as a day you planned to study and did not. */
    accuracy: day.plannedMinutes
      ? Math.round((day.minutes / day.plannedMinutes) * 100)
      : null,
  }));

  return (
    <div
      className="analytics-chart analytics-accuracy-chart"
      role="img"
      aria-label={ar ? "رسم دقة الخطة" : "Plan accuracy chart"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 4, left: -26, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
          <YAxis {...axis} tickFormatter={(value) => `${value}%`} />
          <Tooltip content={<ChartTooltip formatValue={(value) => `${value}%`} />} />
          {/* The target, drawn once instead of stated in a caption. Bars above it are days that
              overran the plan, which is information -- so the axis is deliberately not clamped
              to 100. */}
          <ReferenceLine
            y={100}
            stroke="var(--secondary)"
            strokeDasharray="4 4"
            label={{ value: ar ? "الخطة" : "plan", position: "insideTopRight", fontSize: 10, fill: "var(--muted)" }}
          />
          <Bar
            dataKey="accuracy"
            name={ar ? "دقة الخطة" : "Plan accuracy"}
            fill="var(--primary)"
            stroke="var(--secondary)"
            strokeWidth={1.2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Where the time went, by course.
 *
 * `Cell fill` comes from the course's own `colorToken`, not from a rotating palette indexed by
 * rank -- which is what it used to be, so a course was teal on the pinboard and blue here, and
 * changed colour the week it slipped from second place to third.
 */
export function SubjectDonut({
  subjects,
  total,
  ar,
}: {
  subjects: { id: string; name: string; colorToken: string; minutes: number }[];
  total: number;
  ar: boolean;
}) {
  const drawable = subjects.filter((subject) => subject.minutes > 0);
  return (
    <div className="analytics-chart analytics-donut-chart">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={drawable}
            dataKey="minutes"
            nameKey="name"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={3}
          >
            {drawable.map((subject) => (
              <Cell
                key={subject.id}
                fill={subjectVar(subject.colorToken)}
                stroke="var(--secondary)"
                strokeWidth={1.5}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatValue={(value) => formatMinutes(value, ar)} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="analytics-donut-label">
        <strong>{formatMinutes(total, ar)}</strong>
        <span>{ar ? "إجمالي" : "total"}</span>
      </div>
    </div>
  );
}

/**
 * How long sessions actually run, with the average planned length marked.
 *
 * The mark is the point of the chart: a tall bar to the left of it means sessions are being
 * abandoned early, and a tall bar to the right means the timer is being ignored. Either is
 * actionable; the counts alone are not.
 */
export function SessionLengthChart({
  buckets,
  plannedAverage,
  ar,
}: {
  buckets: { from: number; to: number | null; count: number }[];
  plannedAverage: number;
  ar: boolean;
}) {
  const rows = buckets.map((bucket) => ({
    ...bucket,
    label: bucket.to == null ? `${bucket.from}+` : `${bucket.from}–${bucket.to}`,
  }));
  /* The mark sits on a category, not a pixel: the axis is a list of buckets, so the reference line
     has to name the bucket the planned average falls into. */
  const marked = rows.find(
    (bucket) => plannedAverage >= bucket.from && (bucket.to == null || plannedAverage < bucket.to),
  );

  return (
    <div
      className="analytics-chart analytics-length-chart"
      role="img"
      aria-label={ar ? "توزيع أطوال الجلسات" : "Session length distribution"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 4, left: -26, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip
            content={
              <ChartTooltip
                formatLabel={(label) => (ar ? `${label} دقيقة` : `${label} min`)}
                formatValue={(value) => (ar ? `${value} جلسات` : `${value} sessions`)}
              />
            }
          />
          {marked && plannedAverage > 0 ? (
            <ReferenceLine
              x={marked.label}
              stroke="var(--secondary)"
              strokeDasharray="4 4"
              label={{
                value: ar ? "المخطط" : "planned",
                position: "top",
                fontSize: 10,
                fill: "var(--muted)",
              }}
            />
          ) : null}
          <Bar
            dataKey="count"
            name={ar ? "جلسات" : "Sessions"}
            fill="var(--primary)"
            stroke="var(--secondary)"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Minutes by day of the week, in the reader's own week order. */
export function WeekdayRhythmChart({
  byWeekday,
  weekStartsOn,
  locale,
}: {
  byWeekday: { weekday: number; minutes: number; sessions: number }[];
  weekStartsOn: number;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const labels = weekdayLabels(locale);
  const rows = weekdayOrder(weekStartsOn).map((weekday) => ({
    label: labels[weekday],
    minutes: byWeekday[weekday]?.minutes ?? 0,
    sessions: byWeekday[weekday]?.sessions ?? 0,
  }));
  const peak = rows.reduce((best, row) => Math.max(best, row.minutes), 0);

  return (
    <div
      className="analytics-chart analytics-weekday-chart"
      role="img"
      aria-label={ar ? "إيقاع أيام الأسبوع" : "Weekday rhythm"}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
          <CartesianGrid {...grid} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} />
          <Tooltip
            content={
              <ChartTooltip
                formatValue={(value) => formatMinutes(value, ar)}
                footer={(datum) =>
                  ar ? `${datum.sessions} جلسات` : `${datum.sessions} sessions`
                }
              />
            }
          />
          <Bar
            dataKey="minutes"
            name={ar ? "دقائق" : "Minutes"}
            stroke="var(--secondary)"
            strokeWidth={1.5}
            radius={[5, 5, 0, 0]}
          >
            {/* The best day filled solid and the rest tinted: the whole question this chart
                answers is "which day is mine", and one emphasised bar answers it faster than
                seven bars of equal weight and a squint at the axis. */}
            {rows.map((row) => (
              <Cell
                key={row.label}
                fill={row.minutes === peak && peak > 0 ? "var(--primary)" : "var(--primary-subtle)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Deliberately no flat "minutes by hour" bar chart here any more. It could not tell "every evening"
   from "one six-hour Saturday", which is the question the day x hour heatmap in analytics-heatmaps
   answers instead. `byHour` is still aggregated -- the signals panel reads it for the best hour. */
