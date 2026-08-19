"use client";

import type { ReactNode } from "react";

/**
 * The one tooltip every chart on /analytics uses.
 *
 * It replaces recharts' `contentStyle` object, which had two problems that could not be fixed in
 * place. It cannot express a two-axis `border-radius`, so the tooltip was the only rounded-with-a-
 * ruler rectangle on a hand-drawn page; and being an inline style it had to name its colours as
 * literals -- `border: "2px solid #263D5B"`, `boxShadow: "3px 3px 0 #263D5B"` -- which is ink the
 * colour of the *paper* in the cosmic mood, where --secondary is #E2E8F0 over a #182234 surface.
 * A real DOM node with a real class solves both: the stylesheet owns the shape and the tokens.
 *
 * Every injected prop is optional because recharts clones this element and supplies them; the
 * call site only ever passes the formatters.
 */

type Entry = {
  name?: number | string;
  value?: number | string | ReadonlyArray<number | string>;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
};

export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
  /** Rows whose value is null/undefined are dropped by default -- a gap in a series is not a zero. */
  showEmpty = false,
  footer,
}: {
  active?: boolean;
  payload?: readonly Entry[];
  label?: string | number;
  formatLabel?: (label: string | number | undefined) => ReactNode;
  formatValue?: (value: number, entry: Entry) => ReactNode;
  showEmpty?: boolean;
  /** Extra line built from the hovered datum, e.g. "3 sessions". */
  footer?: (datum: Record<string, unknown>) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((entry) => showEmpty || entry.value != null);
  if (!rows.length) return null;

  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{formatLabel ? formatLabel(label) : label}</p>
      <ul>
        {rows.map((entry, index) => (
          <li key={`${String(entry.dataKey)}-${index}`}>
            {/* The series' own colour, which is a var() string -- see the note on the chart
                props. A custom property resolves in a style attribute exactly as it does in a
                stylesheet, so the swatch tracks the mood with no lookup here. */}
            <i style={{ background: entry.color }} aria-hidden="true" />
            <span>{entry.name}</span>
            <strong>
              {typeof entry.value === "number" && formatValue
                ? formatValue(entry.value, entry)
                : String(entry.value ?? "—")}
            </strong>
          </li>
        ))}
      </ul>
      {footer && rows[0]?.payload ? (
        <p className="analytics-tooltip-footer">{footer(rows[0].payload)}</p>
      ) : null}
    </div>
  );
}
