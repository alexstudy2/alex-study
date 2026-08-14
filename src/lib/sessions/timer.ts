export type TimerSnapshot = {
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  durationSeconds: number;
  segmentStartedAt: Date | null;
  accumulatedActiveSeconds: number;
};

export function activeSeconds(run: TimerSnapshot, now = new Date()) {
  const segment =
    run.status === "RUNNING" && run.segmentStartedAt
      ? Math.max(0, Math.floor((now.getTime() - run.segmentStartedAt.getTime()) / 1000))
      : 0;
  return Math.min(run.durationSeconds, run.accumulatedActiveSeconds + segment);
}

export function remainingSeconds(run: TimerSnapshot, now = new Date()) {
  return Math.max(0, run.durationSeconds - activeSeconds(run, now));
}

export function focusScore(actualSeconds: number, plannedSeconds: number, distractions: number) {
  if (actualSeconds <= 0 || plannedSeconds <= 0) return 0;
  const plannedRatio = actualSeconds / plannedSeconds;
  const distractionRate = Math.min(1, distractions / Math.max(1, actualSeconds / 60));
  return (
    Math.round(Math.max(0, Math.min(100, plannedRatio * 60 + (1 - distractionRate) * 40)) * 10) / 10
  );
}
