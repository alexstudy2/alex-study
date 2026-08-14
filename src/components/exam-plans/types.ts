export type ExamPlanStatus =
  "GENERATING" | "PROPOSED" | "PARTIALLY_ACCEPTED" | "ACCEPTED" | "REJECTED";

export type ExamPlanSubject = {
  id: string;
  name: string;
  colorToken: string;
};

export type ExamPlanItem = {
  id: string;
  title: string;
  notes: string | null;
  plannedDate: string | Date;
  estimatedMinutes: number;
  sortOrder: number;
  accepted: boolean;
  acceptedAt: string | Date | null;
  rejectedAt: string | Date | null;
  subject: ExamPlanSubject | null;
  createdTask: { id: string; title: string; status: string } | null;
};

export type ExamPlan = {
  id: string;
  title: string;
  overview: string | null;
  examAt: string | Date;
  status: ExamPlanStatus;
  locale: "EN" | "AR";
  model: string;
  promptVersion: string;
  contextPurgeAt: string | Date;
  contextPurgedAt: string | Date | null;
  acceptedAt: string | Date | null;
  rejectedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: ExamPlanItem[];
};

export type SubjectOption = Pick<ExamPlanSubject, "id" | "name">;
