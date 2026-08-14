import { addDays, endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { DEFAULT_TIMEZONE } from "@/lib/tasks/dates";

export const INSIGHT_DETECTOR_VERSION = "phase10-signals-v1";

export type InsightType =
  "DAILY_TIP" | "WEEKLY_RECAP" | "PERFORMANCE_DROP" | "BURNOUT" | "BEST_TIME";

export type InsightSignal = {
  type: InsightType;
  detectorVersion: typeof INSIGHT_DETECTOR_VERSION;
  confidence: "moderate" | "strong";
  period: { from: string; to: string; timezone: typeof DEFAULT_TIMEZONE };
  facts: Record<string, string | number | boolean | null>;
};

export type SignalSession = {
  startedAt: Date;
  durationSeconds: number;
  plannedDurationSeconds: number;
  distractionCount: number;
  focusScore: number | null;
  subjectName: string | null;
};

export type SignalTask = {
  completedAt: Date | null;
  dueAt: Date | null;
};

export type PersonalSignalData = {
  sessions: SignalSession[];
  tasks: SignalTask[];
};

type DateRange = { from: Date; to: Date };

function toUtcRange(from: Date, to: Date): DateRange {
  return {
    from: fromZonedTime(from, DEFAULT_TIMEZONE),
    to: fromZonedTime(to, DEFAULT_TIMEZONE),
  };
}

function trailingCompleteDays(now: Date, days: number, offsetDays = 0) {
  const localDay = startOfDay(toZonedTime(now, DEFAULT_TIMEZONE));
  return toUtcRange(
    startOfDay(addDays(localDay, -days - offsetDays)),
    endOfDay(addDays(localDay, -1 - offsetDays)),
  );
}

function currentSevenDays(now: Date) {
  const localDay = startOfDay(toZonedTime(now, DEFAULT_TIMEZONE));
  return {
    from: fromZonedTime(addDays(localDay, -6), DEFAULT_TIMEZONE),
    to: now,
  };
}

function completedCairoWeek(now: Date, weeksAgo = 1) {
  const localDay = startOfDay(toZonedTime(now, DEFAULT_TIMEZONE));
  const currentWeekStart = addDays(localDay, -localDay.getDay());
  const from = addDays(currentWeekStart, -7 * weeksAgo);
  return toUtcRange(from, endOfDay(addDays(from, 6)));
}

function within(value: Date | null, range: DateRange) {
  return Boolean(value && value >= range.from && value <= range.to);
}

function localDateKey(value: Date) {
  return toZonedTime(value, DEFAULT_TIMEZONE).toISOString().slice(0, 10);
}

function summary(data: PersonalSignalData, range: DateRange) {
  const sessions = data.sessions.filter((item) => within(item.startedAt, range));
  const completedTasks = data.tasks.filter((item) => within(item.completedAt, range)).length;
  const dueTasks = data.tasks.filter((item) => within(item.dueAt, range)).length;
  const studyMinutes = Math.round(
    sessions.reduce((total, item) => total + item.durationSeconds, 0) / 60,
  );
  const plannedMinutes = Math.round(
    sessions.reduce((total, item) => total + item.plannedDurationSeconds, 0) / 60,
  );
  const scores = sessions.flatMap((item) => (item.focusScore == null ? [] : [item.focusScore]));
  const subjectMinutes = new Map<string, number>();
  const dailyMinutes = new Map<string, number>();
  for (const session of sessions) {
    if (session.subjectName)
      subjectMinutes.set(
        session.subjectName,
        (subjectMinutes.get(session.subjectName) ?? 0) + session.durationSeconds / 60,
      );
    const key = localDateKey(session.startedAt);
    dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + session.durationSeconds / 60);
  }
  const topSubject = [...subjectMinutes.entries()].sort((left, right) => right[1] - left[1])[0];
  const distractionCount = sessions.reduce((total, item) => total + item.distractionCount, 0);
  return {
    sessions,
    studyMinutes,
    plannedMinutes,
    completedTasks,
    dueTasks,
    activeDays: dailyMinutes.size,
    longDays: [...dailyMinutes.values()].filter((minutes) => minutes >= 180).length,
    averageFocusScore: scores.length
      ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) / 10
      : null,
    distractionCount,
    distractionsPerHour:
      studyMinutes > 0 ? Math.round((distractionCount / (studyMinutes / 60)) * 10) / 10 : 0,
    lateNightSessions: sessions.filter((item) => {
      const hour = toZonedTime(item.startedAt, DEFAULT_TIMEZONE).getHours();
      return hour >= 23 || hour < 5;
    }).length,
    actualToPlannedRatio:
      plannedMinutes > 0 ? Math.round((studyMinutes / plannedMinutes) * 100) / 100 : null,
    topSubject: topSubject?.[0] ?? null,
    topSubjectMinutes: topSubject ? Math.round(topSubject[1]) : 0,
  };
}

function period(range: DateRange) {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timezone: DEFAULT_TIMEZONE,
  } as const;
}

export function buildDailyTipSignal(data: PersonalSignalData, now = new Date()): InsightSignal {
  const range = currentSevenDays(now);
  const recent = summary(data, range);
  return {
    type: "DAILY_TIP",
    detectorVersion: INSIGHT_DETECTOR_VERSION,
    confidence: recent.sessions.length >= 3 ? "strong" : "moderate",
    period: period(range),
    facts: {
      studyMinutes: recent.studyMinutes,
      plannedMinutes: recent.plannedMinutes,
      activeDays: recent.activeDays,
      tasksCompleted: recent.completedTasks,
      tasksDue: recent.dueTasks,
      averageFocusScore: recent.averageFocusScore,
      topSubject: recent.topSubject,
    },
  };
}

export function buildWeeklyRecapSignal(
  data: PersonalSignalData,
  now = new Date(),
): InsightSignal | null {
  const recentRange = completedCairoWeek(now, 1);
  const previousRange = completedCairoWeek(now, 2);
  const recent = summary(data, recentRange);
  const previous = summary(data, previousRange);
  if (recent.sessions.length === 0 && recent.completedTasks === 0) return null;
  return {
    type: "WEEKLY_RECAP",
    detectorVersion: INSIGHT_DETECTOR_VERSION,
    confidence: recent.sessions.length >= 3 ? "strong" : "moderate",
    period: period(recentRange),
    facts: {
      studyMinutes: recent.studyMinutes,
      previousStudyMinutes: previous.studyMinutes,
      studyMinutesChangePercent: previous.studyMinutes
        ? Math.round(((recent.studyMinutes - previous.studyMinutes) / previous.studyMinutes) * 100)
        : null,
      activeDays: recent.activeDays,
      tasksCompleted: recent.completedTasks,
      averageFocusScore: recent.averageFocusScore,
      topSubject: recent.topSubject,
      topSubjectMinutes: recent.topSubjectMinutes,
    },
  };
}

export function detectPerformanceDrop(
  data: PersonalSignalData,
  now = new Date(),
): InsightSignal | null {
  const recentRange = trailingCompleteDays(now, 7);
  const previousRange = trailingCompleteDays(now, 7, 7);
  const recent = summary(data, recentRange);
  const previous = summary(data, previousRange);
  const minutesDropped =
    previous.studyMinutes >= 180 &&
    previous.studyMinutes - recent.studyMinutes >= 90 &&
    recent.studyMinutes <= previous.studyMinutes * 0.7;
  const tasksDropped =
    previous.completedTasks >= 5 &&
    previous.completedTasks - recent.completedTasks >= 3 &&
    recent.completedTasks <= previous.completedTasks * 0.5;
  if (!minutesDropped && !tasksDropped) return null;
  const primaryMetric = minutesDropped ? "study_minutes" : "tasks_completed";
  const recentValue = minutesDropped ? recent.studyMinutes : recent.completedTasks;
  const previousValue = minutesDropped ? previous.studyMinutes : previous.completedTasks;
  return {
    type: "PERFORMANCE_DROP",
    detectorVersion: INSIGHT_DETECTOR_VERSION,
    confidence: minutesDropped && tasksDropped ? "strong" : "moderate",
    period: period(recentRange),
    facts: {
      primaryMetric,
      recentValue,
      previousValue,
      changePercent: Math.round(((recentValue - previousValue) / previousValue) * 100),
      recentActiveDays: recent.activeDays,
      previousActiveDays: previous.activeDays,
      recentAverageFocusScore: recent.averageFocusScore,
      previousAverageFocusScore: previous.averageFocusScore,
    },
  };
}

export function detectBurnoutRisk(
  data: PersonalSignalData,
  now = new Date(),
): InsightSignal | null {
  const recentRange = trailingCompleteDays(now, 7);
  const previousRange = trailingCompleteDays(now, 7, 7);
  const recent = summary(data, recentRange);
  const previous = summary(data, previousRange);
  if (recent.studyMinutes < 840 || recent.activeDays < 6 || recent.longDays < 3) return null;
  const focusDrop =
    recent.averageFocusScore != null &&
    previous.averageFocusScore != null &&
    previous.averageFocusScore - recent.averageFocusScore >= 10 &&
    recent.averageFocusScore <= 78;
  const distractionLoad = recent.distractionCount >= 8 && recent.distractionsPerHour >= 1.5;
  const lateNightLoad = recent.lateNightSessions >= 3;
  const planOverrun =
    recent.plannedMinutes >= 600 &&
    recent.actualToPlannedRatio != null &&
    recent.actualToPlannedRatio >= 1.15;
  const strainMarkers = [focusDrop, distractionLoad, lateNightLoad, planOverrun].filter(Boolean);
  if (strainMarkers.length < 2) return null;
  return {
    type: "BURNOUT",
    detectorVersion: INSIGHT_DETECTOR_VERSION,
    confidence: "strong",
    period: period(recentRange),
    facts: {
      noticeKind: "workload_check_in_not_diagnosis",
      studyMinutes: recent.studyMinutes,
      activeDays: recent.activeDays,
      longStudyDays: recent.longDays,
      averageFocusScore: recent.averageFocusScore,
      previousAverageFocusScore: previous.averageFocusScore,
      distractionsPerHour: recent.distractionsPerHour,
      lateNightSessions: recent.lateNightSessions,
      actualToPlannedRatio: recent.actualToPlannedRatio,
      strainMarkerCount: strainMarkers.length,
    },
  };
}

type ProductiveWindow = {
  key: "early_morning" | "late_morning" | "afternoon" | "evening" | "night";
  startHour: number;
  endHour: number;
};

function productiveWindow(hour: number): ProductiveWindow {
  if (hour >= 5 && hour < 9) return { key: "early_morning", startHour: 5, endHour: 9 };
  if (hour >= 9 && hour < 13) return { key: "late_morning", startHour: 9, endHour: 13 };
  if (hour >= 13 && hour < 17) return { key: "afternoon", startHour: 13, endHour: 17 };
  if (hour >= 17 && hour < 21) return { key: "evening", startHour: 17, endHour: 21 };
  return { key: "night", startHour: 21, endHour: 5 };
}

export function detectBestTime(data: PersonalSignalData, now = new Date()): InsightSignal | null {
  const range = trailingCompleteDays(now, 28);
  const groups = new Map<string, { window: ProductiveWindow; sessions: SignalSession[] }>();
  for (const session of data.sessions.filter((item) => within(item.startedAt, range))) {
    const window = productiveWindow(toZonedTime(session.startedAt, DEFAULT_TIMEZONE).getHours());
    const group = groups.get(window.key) ?? { window, sessions: [] };
    group.sessions.push(session);
    groups.set(window.key, group);
  }
  const candidates = [...groups.values()]
    .map((group) => {
      const scores = group.sessions.flatMap((item) =>
        item.focusScore == null ? [] : [item.focusScore],
      );
      return {
        ...group,
        minutes: Math.round(
          group.sessions.reduce((total, item) => total + item.durationSeconds, 0) / 60,
        ),
        averageFocusScore: scores.length
          ? Math.round((scores.reduce((total, score) => total + score, 0) / scores.length) * 10) /
            10
          : null,
        scoredSessions: scores.length,
      };
    })
    .filter(
      (group) =>
        group.sessions.length >= 3 &&
        group.minutes >= 90 &&
        group.scoredSessions >= 2 &&
        (group.averageFocusScore ?? 0) >= 65,
    )
    .sort(
      (left, right) =>
        (right.averageFocusScore ?? 0) - (left.averageFocusScore ?? 0) ||
        right.minutes - left.minutes,
    );
  const best = candidates[0];
  if (!best) return null;
  return {
    type: "BEST_TIME",
    detectorVersion: INSIGHT_DETECTOR_VERSION,
    confidence: best.sessions.length >= 5 ? "strong" : "moderate",
    period: period(range),
    facts: {
      timeWindow: best.window.key,
      startHour: best.window.startHour,
      endHour: best.window.endHour,
      sessionCount: best.sessions.length,
      studyMinutes: best.minutes,
      averageFocusScore: best.averageFocusScore,
      observationOnly: true,
    },
  };
}
