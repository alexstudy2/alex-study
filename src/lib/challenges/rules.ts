export const MIN_COMPETITIVE_TASK_MINUTES = 10;
export const TASK_THROTTLE_MS = 5 * 60 * 1000;

export type TaskSource = {
  id: string;
  completedAt: Date | null;
  estimatedMinutes: number | null;
  status: string;
  deletedAt: Date | null;
  parentTaskId: string | null;
  subjectKey: string | null;
};

export type SessionSource = {
  id: string;
  endedAt: Date | null;
  durationSeconds: number;
  status: string;
  source: string;
  subjectKey: string | null;
};

export function eligibleTasks(tasks: TaskSource[], subjectKey?: string | null) {
  const ordered = tasks
    .filter(
      (task) =>
        task.status === "COMPLETED" &&
        !task.deletedAt &&
        !task.parentTaskId &&
        Boolean(task.completedAt) &&
        (task.estimatedMinutes ?? 0) >= MIN_COMPETITIVE_TASK_MINUTES &&
        (!subjectKey || task.subjectKey === subjectKey),
    )
    .sort(
      (a, b) => a.completedAt!.getTime() - b.completedAt!.getTime() || a.id.localeCompare(b.id),
    );
  const selected: TaskSource[] = [];
  for (const task of ordered) {
    const previous = selected.at(-1);
    if (
      !previous ||
      task.completedAt!.getTime() - previous.completedAt!.getTime() >= TASK_THROTTLE_MS
    )
      selected.push(task);
  }
  return selected;
}

export function eligibleSessions(sessions: SessionSource[], subjectKey?: string | null) {
  return sessions
    .filter(
      (session) =>
        session.status === "COMPLETED" &&
        session.source !== "MANUAL" &&
        Boolean(session.endedAt) &&
        session.durationSeconds >= 60 &&
        (!subjectKey || session.subjectKey === subjectKey),
    )
    .sort((a, b) => a.endedAt!.getTime() - b.endedAt!.getTime() || a.id.localeCompare(b.id));
}

export function targetReachedAt(
  sources: Array<{ occurredAt: Date; value: number }>,
  target: number,
) {
  let total = 0;
  for (const source of sources) {
    total += source.value;
    if (total >= target) return source.occurredAt;
  }
  return null;
}

export function progressEventRevision(input: {
  current: number;
  wanted: number;
  hasHistory: boolean;
  sourceOccurredAt: Date;
  now: Date;
}) {
  const delta = input.wanted - input.current;
  if (!delta) return null;
  const firstSourceEvent = !input.hasHistory && input.current === 0 && input.wanted > 0;
  return {
    delta,
    eventType: firstSourceEvent ? ("SOURCE" as const) : ("ADJUSTMENT" as const),
    occurredAt: firstSourceEvent ? input.sourceOccurredAt : input.now,
  };
}

export function publicName(name: string, shareFullName: boolean) {
  return shareFullName ? name : name.trim().split(/\s+/)[0] || "Student";
}

export function resolveChallenge(input: {
  resolutionType: "TARGET_FIRST" | "DEADLINE_LEADER";
  targetValue: number;
  startsAt: Date;
  endsAt: Date;
  now: Date;
  participants: Array<{ userId: string; value: number; targetReachedAt: Date | null }>;
}) {
  if (input.now < input.startsAt) return { status: "SCHEDULED" as const, winnerId: null };
  if (input.resolutionType === "TARGET_FIRST") {
    const reached = input.participants
      .filter(
        (participant) => participant.value >= input.targetValue && participant.targetReachedAt,
      )
      .sort((a, b) => a.targetReachedAt!.getTime() - b.targetReachedAt!.getTime());
    if (reached.length) {
      const tied = reached[1]?.targetReachedAt?.getTime() === reached[0].targetReachedAt?.getTime();
      return { status: "COMPLETED" as const, winnerId: tied ? null : reached[0].userId };
    }
    return input.now >= input.endsAt
      ? { status: "EXPIRED" as const, winnerId: null }
      : { status: "ACTIVE" as const, winnerId: null };
  }
  if (input.now < input.endsAt) return { status: "ACTIVE" as const, winnerId: null };
  const ordered = [...input.participants].sort((a, b) => b.value - a.value);
  const tied = ordered.length > 1 && ordered[0].value === ordered[1].value;
  return { status: "COMPLETED" as const, winnerId: tied ? null : (ordered[0]?.userId ?? null) };
}

export function utcLeaderboardWeek(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((day + 6) % 7));
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end };
}

export function rankedRows<T extends { value: number; secondaryValue: number; name: string }>(
  rows: T[],
) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.value - a.value || b.secondaryValue - a.secondaryValue || a.name.localeCompare(b.name),
  );
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const tied = previous && previous.value === row.value;
    return {
      ...row,
      rank: tied ? sorted.findIndex((candidate) => candidate.value === row.value) + 1 : index + 1,
    };
  });
}
