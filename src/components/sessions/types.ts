export type TimerMode = "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
export type TimerRun = {
  id: string;
  mode: TimerMode;
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  durationSeconds: number;
  startedAt: string | Date;
  segmentStartedAt: string | Date | null;
  accumulatedActiveSeconds: number;
  version: number;
  task: { id: string; title: string } | null;
  subject: { id: string; name: string; colorToken: string } | null;
  session: { id: string; distractionCount: number } | null;
};
export type Session = {
  id: string;
  startedAt: string | Date;
  endedAt: string | Date | null;
  durationSeconds: number;
  plannedDurationSeconds: number;
  distractionCount: number;
  focusScore: number | null;
  reflection: string | null;
  source: "SOLO" | "ROOM" | "MANUAL";
  status: "ACTIVE" | "COMPLETED" | "ABANDONED";
  task: { id: string; title: string } | null;
  subject: { id: string; name: string; colorToken: string } | null;
  distractions: { id: string; occurredAt: string | Date; note: string | null }[];
};
