export type CalendarEvent = {
  /** "plan" events come from a Plan Forum note painted over the grid; they are read-only. */
  type: "task" | "session" | "plan";
  id: string;
  startsAt: string | Date;
  title: string;
  subject: { id: string; name: string; colorToken: string } | null;
  status: string;
  minutes: number | null;
  priority: string | null;
};
