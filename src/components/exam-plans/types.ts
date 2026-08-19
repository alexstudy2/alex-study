import type { ExamItemKind, ExamStudyMode, QuestionStrategy } from "@/lib/exam-plans/topics";

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
  kind: ExamItemKind;
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
  questionStrategy: QuestionStrategy;
  studyMode: ExamStudyMode;
  dailyCapacityMinutes: number;
  /** The Plan Forum copy, once published. Null until the student presses Publish. */
  studyPlanId: string | null;
  contextPurgeAt: string | Date;
  contextPurgedAt: string | Date | null;
  acceptedAt: string | Date | null;
  rejectedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: ExamPlanItem[];
};

/** The colour comes along so the board paints a note the shade the forum will paint it after publish. */
export type SubjectOption = Pick<ExamPlanSubject, "id" | "name" | "colorToken">;
