export type CalendarEvent = {
  type: "task" | "session";
  id: string;
  startsAt: string | Date;
  title: string;
  subject: { id: string; name: string; colorToken: string } | null;
  status: string;
  minutes: number | null;
  priority: string | null;
};
