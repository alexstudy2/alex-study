import { TrendingUp } from "lucide-react";

export type WeekDay = {
  /** One or two characters, already localised by the caller via Intl. */
  label: string;
  /** The full weekday name, for the tooltip and the screen-reader line. */
  full: string;
  minutes: number;
  isToday: boolean;
  /** Days after today in the current week, which have not happened yet. */
  isFuture: boolean;
};

/* The drawing's own coordinate space. Stretched to the card with
   `preserveAspectRatio="none"`, so these numbers are ratios, not pixels: x runs 0..700 in seven
   100-wide columns and the curve sits on each column's centre, which is what lets the day labels
   below live in an ordinary 7-track grid and still line up with the points.
   TOP and BOTTOM inset the band so a 100% day's stroke and its dot are not half-clipped by the
   viewBox edge. */
const VB_W = 700;
const VB_H = 200;
const TOP = 16;
const BOTTOM = 184;
const COL = VB_W / 7;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Catmull-Rom through the points, emitted as cubic Béziers.
 *
 * A polyline would be honest and would also look like a stock chart from 1994; this is the curve
 * that makes seven samples read as one continuous week. Tension is 0.55 rather than the textbook
 * 1.0 because a study week is spiky -- a four-hour Sunday next to an empty Monday -- and at full
 * tension the curve overshoots hard enough to loop below the axis between them.
 *
 * The control points are clamped into the band as well, which is what actually guarantees the
 * curve stays inside it: a cubic Bézier is contained in the convex hull of its four control
 * points, so if all four are within [TOP, BOTTOM] the segment cannot leave it. Clamping the
 * endpoints alone would not be enough.
 */
function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  const clamp = (y: number) => Math.min(BOTTOM, Math.max(TOP, y));
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = 0.55;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const c1y = clamp(p1.y + ((p2.y - p0.y) / 6) * t);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const c2y = clamp(p2.y - ((p3.y - p1.y) / 6) * t);
    d += ` C ${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/**
 * Study minutes per day across the current week, as one continuous curve.
 *
 * Every colour in it is `--primary` or `--accent`, which each mood redeclares, so the graph is the
 * palette rather than a chart that happens to sit on it -- switch to Sakura and the line is rose,
 * to Sunset and it is amber. Nothing here is hardcoded and nothing is a chart library: the path is
 * arithmetic done on the server, the gradients are two `<linearGradient>`s whose stops are set from
 * palette tokens in components.css, and the whole card ships zero JavaScript.
 *
 * Structure is two layers over one shared coordinate space -- an SVG for the area and the line,
 * and absolutely-placed HTML dots on top. The dots are HTML rather than `<circle>` elements
 * because `preserveAspectRatio="none"` scales x and y by different factors, which would turn every
 * circle into an ellipse of a different eccentricity at every viewport width. The line survives
 * that same stretch via `vector-effect="non-scaling-stroke"`.
 *
 * The curve spans only the days that have happened. Carrying it through the rest of the week would
 * draw a plunge to zero on Wednesday evening and call it data.
 */
export function WeekHoursChart({
  ar,
  days,
  totalMinutes,
}: {
  ar: boolean;
  days: WeekDay[];
  totalMinutes: number;
}) {
  /* Scaled to the week's own busiest day, not to a fixed ceiling. A fixed ceiling has to be wrong
     for somebody: 8h flattens a 40-minute-a-day week into a line along the floor, and 1h clips a
     heavy one flat against the top. Relative scaling keeps the shape of the week legible and lets
     the total and the tooltips carry the absolute numbers. */
  const peak = Math.max(...days.map((day) => day.minutes), 0);
  const hours = (minutes: number) => {
    const whole = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!minutes) return ar ? "لا شيء" : "none";
    if (!whole) return ar ? `${rest} د` : `${rest}m`;
    if (!rest) return ar ? `${whole} س` : `${whole}h`;
    return ar ? `${whole} س ${rest} د` : `${whole}h ${rest}m`;
  };

  const x = (index: number) => COL * index + COL / 2;
  const y = (minutes: number) => (peak > 0 ? BOTTOM - (minutes / peak) * (BOTTOM - TOP) : BOTTOM);
  const elapsed = days.filter((day) => !day.isFuture);
  const points = elapsed.map((day, index) => ({ x: x(index), y: y(day.minutes) }));
  const line = smoothPath(points);
  /* The fill is the same curve closed along the floor. Only drawn from two points on: a single
     elapsed day gives a zero-width region, which some renderers still paint as a hairline. */
  const area =
    points.length > 1
      ? `${line} L ${round(points[points.length - 1].x)} ${BOTTOM} L ${round(points[0].x)} ${BOTTOM} Z`
      : "";

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold">{ar ? "ساعات الأسبوع" : "Hours this week"}</h2>
        </div>
        <strong className="week-chart-total font-mono">{hours(totalMinutes)}</strong>
      </div>

      <div className="week-chart" data-empty={peak === 0 ? "yes" : undefined}>
        <div className="week-chart-plot">
          {/* Decorative: every number in it is also in the list below, where a screen reader can
              actually get at it. `focusable="false"` because IE-era SVGs are still tab stops in
              some engines and this one is not interactive. */}
          <svg
            className="week-chart-svg"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {/* Stop colours come from CSS, not from `stop-color` attributes: `var()` inside a
                  presentation attribute is not reliably resolved, whereas `stop-color` set from a
                  stylesheet is. That indirection is the whole mechanism by which the graph follows
                  the mood -- see `.week-chart-area-from` and friends in components.css. */}
              <linearGradient id="week-chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop className="week-chart-area-from" offset="0%" />
                <stop className="week-chart-area-to" offset="100%" />
              </linearGradient>
              <linearGradient id="week-chart-line-grad" x1="0" y1="0" x2="1" y2="0">
                <stop className="week-chart-line-from" offset="0%" />
                <stop className="week-chart-line-to" offset="100%" />
              </linearGradient>
            </defs>

            {/* Three hairlines instead of a full grid. Enough to give the curve something to be
                high or low against; any more and the card turns into graph paper. */}
            <line className="week-chart-grid" x1="0" x2={VB_W} y1={TOP} y2={TOP} />
            <line className="week-chart-grid" x1="0" x2={VB_W} y1={(TOP + BOTTOM) / 2} y2={(TOP + BOTTOM) / 2} />
            <line className="week-chart-axis-line" x1="0" x2={VB_W} y1={BOTTOM} y2={BOTTOM} />

            {area && <path className="week-chart-area" d={area} fill="url(#week-chart-area-grad)" />}
            {line && (
              <path
                className="week-chart-line"
                d={line}
                fill="none"
                stroke="url(#week-chart-line-grad)"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/* One dot per elapsed day, placed in the same coordinate space as the curve: `--x` and
              `--y` are that day's viewBox position expressed as a bare percentage of the box, so
              the two layers cannot drift. Bare numbers because the CSS multiplies by 1% itself. */}
          {elapsed.map((day, index) => (
            <span
              key={day.full}
              className="week-chart-dot"
              data-today={day.isToday ? "yes" : undefined}
              aria-hidden="true"
              style={
                {
                  "--x": round((x(index) / VB_W) * 100),
                  "--y": round((y(day.minutes) / VB_H) * 100),
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* The axis is also the data table. Seven items in a 7-track grid, so each label sits
            under its own column centre and therefore under its own point, and each carries the
            value the curve is drawing for anyone who cannot see the curve. */}
        <ul className="week-chart-axis">
          {days.map((day) => (
            <li
              key={day.full}
              data-today={day.isToday ? "yes" : undefined}
              data-future={day.isFuture ? "yes" : undefined}
              title={`${day.full} · ${hours(day.minutes)}`}
            >
              <span aria-hidden="true">{day.label}</span>
              <span className="sr-only">
                {day.isFuture
                  ? `${day.full}: ${ar ? "لم يأتِ بعد" : "still to come"}`
                  : `${day.full}: ${hours(day.minutes)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {peak === 0 && (
        <p className="week-chart-hint">
          {ar
            ? "لا جلسات مكتملة هذا الأسبوع بعد — ابدأ جلسة تركيز وسيرتفع الخط من هنا."
            : "No completed sessions this week yet — start a focus session and the line lifts off from here."}
        </p>
      )}
    </div>
  );
}
