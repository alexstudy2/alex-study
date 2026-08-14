export type Goal = {
  id: string;
  title: string;
  metric: "STUDY_MINUTES" | "TASKS_COMPLETED";
  targetValue: number;
  period: "WEEKLY" | "MONTHLY" | "CUSTOM";
  startsAt: string | Date;
  deadline: string | Date;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  subject: { id: string; name: string; colorToken: string } | null;
  progress: { currentValue: number; percentage: number; complete: boolean };
};
