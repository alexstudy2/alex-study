import type { PlanColorToken } from "./colors";

/**
 * The shapes the Plan Forum pages and the calendar overlay consume.
 *
 * They live in `lib` rather than beside the components because the query layer is what produces
 * them, and a client type that a server file imports would drag `"use client"` boundaries the
 * wrong way. Compare src/components/calendar/types.ts, which redeclares its shape independently
 * and has to be kept in step with queries.ts by hand -- one source is better.
 *
 * Every date here is a `YYYY-MM-DD` key, never an instant. The Cairo conversion happens once, in
 * the query, so no component has to know what timezone a plan was authored in.
 */

export type PlanItem = {
  id: string;
  dayDate: string;
  title: string;
  subjectLabel: string;
  colorToken: PlanColorToken;
};

export type PlanSummary = {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  dayCount: number;
  itemCount: number;
  saveCount: number;
  visibility: "PRIVATE" | "CLASS";
  sharedAt: string | null;
  author: { id: string; name: string };
  /** True when the viewer wrote it -- the only case that unlocks the add/edit affordances. */
  isMine: boolean;
  savedByMe: boolean;
};

export type PlanDetail = PlanSummary & { items: PlanItem[] };

/** Enough of a plan to name it in the calendar's source select. */
export type PlanOption = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  authorName: string;
  isMine: boolean;
};

/** The viewer, as far as plan authorisation is concerned. Both fields are already on the session. */
export type PlanViewer = { id: string; academicYear: number };
