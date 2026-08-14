export type Subject = { id: string; name: string; colorToken: string };
export type Subtask = {
  id: string;
  title: string;
  notes: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  dueAt: string | Date | null;
  estimatedMinutes: number | null;
  sortOrder: number;
  recurrenceRule: unknown;
};
export type Task = Subtask & { subject: Subject | null; subtasks: Subtask[] };
export type TaskDraft = {
  id: string;
  title: string;
  notes: string | null;
  subjectId: string | null;
  subjectName: string | null;
  priority: Task["priority"];
  dueAt: string | null;
  estimatedMinutes: number | null;
  recurrenceRule: unknown;
};
