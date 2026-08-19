"use client";

import {
  formatDayLabel,
  formatHour,
  formatMinutes,
  intensity,
  parseDayKey,
  weekdayLabels,
  weekdayOrder,
} from "./analytics-format";

/**
 * The two heatmaps, both plain CSS grids rather than recharts.
 *
 * A heatmap is a table of coloured boxes, and recharts has no primitive for that -- the nearest
 * thing is a scatter plot with square symbols, which means 168 SVG nodes carrying computed pixel
 * positions instead of 168 grid cells that lay themselves out. Doing it in CSS also means the
 * colour comes from a token (`color-mix` against --primary), so both maps follow the study mood
 * for free, which is exactly what the hardcoded chart palette on this page failed to do.
 */

/**
 * Study minutes per calendar day: weekdays down, weeks across.
 *
 * Not a <table>: the columns are weeks, and a week has no meaningful header to label a column
 * with, so a table would be announcing "column 3" as though it meant something. `role="img"` with
 * a summary label states the shape in one sentence, and the streak numbers rendered beside it in
 * real text carry the takeaway a screen-reader user actually wants.
 */
export function CalendarHeatmap({
  daily,
  weekStartsOn,
  locale,
}: {
  daily: { date: string; minutes: number }[];
  weekStartsOn: number;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const labels = weekdayLabels(locale);
  const rows = weekdayOrder(weekStartsOn);
  const max = daily.reduce((peak, day) => Math.max(peak, day.minutes), 0);
  const active = daily.filter((day) => day.minutes > 0).length;

  /* How far into its own week the first day of the range sits. Without this the grid would start
     every range on the reader's first weekday, so a month beginning on a Wednesday would be drawn
     shifted two days -- every cell under the wrong weekday label. */
  const offset = daily.length
    ? (parseDayKey(daily[0].date).getUTCDay() - rows[0] + 7) % 7
    : 0;
  const columns = Math.ceil((daily.length + offset) / 7);

  /* Sparse lookup by slot instead of a pre-filled 7 x N array: the only empty slots are the pad
     cells at the two ends of the range, and a Map keyed by slot keeps the render a single lookup
     per cell with no nested allocation. */
  const bySlot = new Map<number, { date: string; minutes: number }>();
  daily.forEach((day, index) => bySlot.set(index + offset, day));

  return (
    <div className="analytics-calendar">
      <div className="analytics-calendar-days" aria-hidden="true">
        {rows.map((weekday) => (
          <span key={weekday}>{labels[weekday]}</span>
        ))}
      </div>
      <div
        className="analytics-calendar-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, var(--cal-cell))` }}
        role="img"
        aria-label={
          ar
            ? `دقائق الدراسة اليومية على مدى ${daily.length} يومًا، منها ${active} أيام نشطة.`
            : `Daily study minutes across ${daily.length} days, ${active} of them active.`
        }
      >
        {Array.from({ length: columns * 7 }, (_, cell) => {
          /* Column-major: the grid flows row by row, so cell n has to be mapped back to the slot
             that belongs at (row n/columns, column n%columns). Writing the days in order instead
             would fill across the weekdays and then down the weeks -- a transposed calendar. */
          const row = Math.floor(cell / columns);
          const column = cell % columns;
          const day = bySlot.get(column * 7 + row);
          if (!day) return <span key={cell} className="analytics-cal-cell" data-empty="true" />;
          return (
            <span
              key={cell}
              className="analytics-cal-cell"
              data-level={intensity(day.minutes, max)}
              title={`${formatDayLabel(day.date, locale)} · ${formatMinutes(day.minutes, ar)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * Minutes by weekday and hour.
 *
 * Rendered twice at two column widths and switched with `display` in the stylesheet, not with a
 * media-query hook: 24 columns are unreadable at 360px and 6 four-hour buckets are too coarse on a
 * desktop, and reading the viewport in JS would mean the server render guesses one of them and
 * corrects itself after hydration. Only one is ever displayed, and `display: none` takes the other
 * out of the accessibility tree, so there is no duplicate announcement.
 */
export function WeekHourHeatmap({
  matrix,
  weekStartsOn,
  locale,
}: {
  matrix: number[][];
  weekStartsOn: number;
  locale: "en" | "ar";
}) {
  return (
    <>
      <HourGrid matrix={matrix} weekStartsOn={weekStartsOn} locale={locale} step={1} />
      <HourGrid matrix={matrix} weekStartsOn={weekStartsOn} locale={locale} step={4} />
    </>
  );
}

function HourGrid({
  matrix,
  weekStartsOn,
  locale,
  step,
}: {
  matrix: number[][];
  weekStartsOn: number;
  locale: "en" | "ar";
  step: number;
}) {
  const ar = locale === "ar";
  const labels = weekdayLabels(locale);
  const rows = weekdayOrder(weekStartsOn);
  const buckets = Array.from({ length: Math.ceil(24 / step) }, (_, index) => index * step);
  const cellMinutes = (weekday: number, hour: number) =>
    matrix[weekday]?.slice(hour, hour + step).reduce((total, value) => total + value, 0) ?? 0;
  const max = rows.reduce(
    (peak, weekday) =>
      buckets.reduce((inner, hour) => Math.max(inner, cellMinutes(weekday, hour)), peak),
    0,
  );

  return (
    /* A real table: both axes have names, so <th scope> is what lets a screen reader read "Tue,
       14:00, 45 minutes" out of a cell instead of leaving it as an unlabelled coloured box. */
    <table className="analytics-hourmap" data-step={step}>
      <caption className="sr-only">
        {ar ? "دقائق الدراسة حسب يوم الأسبوع والساعة" : "Study minutes by weekday and hour"}
      </caption>
      <thead>
        <tr>
          <td />
          {buckets.map((hour) => (
            <th key={hour} scope="col">
              {/* Only every third label at hourly resolution: 24 two-digit labels in the width of
                  a panel overlap into a grey smear. The unlabelled columns are still readable --
                  they sit between two labelled ones. */}
              <span data-hide={step === 1 && hour % 3 !== 0 ? "true" : undefined}>
                {step === 1 ? formatHour(hour) : `${String(hour).padStart(2, "0")}`}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((weekday) => (
          <tr key={weekday}>
            <th scope="row">{labels[weekday]}</th>
            {buckets.map((hour) => {
              const minutes = cellMinutes(weekday, hour);
              return (
                <td
                  key={hour}
                  data-level={intensity(minutes, max)}
                  title={`${labels[weekday]} · ${formatHour(hour)} · ${formatMinutes(minutes, ar)}`}
                >
                  <span className="sr-only">{formatMinutes(minutes, ar)}</span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
