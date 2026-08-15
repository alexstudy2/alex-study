"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Radio } from "lucide-react";
import { activeSeconds } from "@/lib/sessions/timer";

type ActiveTimer = {
  mode: "FOCUS" | "SHORT_BREAK" | "LONG_BREAK";
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  durationSeconds: number;
  accumulatedActiveSeconds: number;
  segmentStartedAt: string | Date | null;
} | null;

export function TodayStudyCard({
  ar,
  completedTodaySeconds,
  plannedMinutes,
  weekMinutes,
  completedWeek,
  averageScore,
  serverNow,
  timer,
}: {
  ar: boolean;
  completedTodaySeconds: number;
  plannedMinutes: number;
  weekMinutes: number;
  completedWeek: number;
  averageScore: number | null;
  serverNow: string;
  timer: ActiveTimer;
}) {
  const initialServerTime = useMemo(() => new Date(serverNow).getTime(), [serverNow]);
  const [now, setNow] = useState(initialServerTime);

  useEffect(() => {
    const offset = initialServerTime - Date.now();
    const handle = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(handle);
  }, [initialServerTime]);

  const liveSeconds =
    timer?.mode === "FOCUS"
      ? activeSeconds(
          {
            ...timer,
            segmentStartedAt: timer.segmentStartedAt ? new Date(timer.segmentStartedAt) : null,
          },
          new Date(now),
        )
      : 0;
  const totalSeconds = completedTodaySeconds + liveSeconds;
  const displayMinutes = Math.floor(totalSeconds / 60);
  const displaySeconds = totalSeconds % 60;
  const targetMinutes = Math.max(plannedMinutes, Math.ceil(totalSeconds / 60));
  const progressPercent = Math.min(
    100,
    plannedMinutes > 0 ? Math.round((totalSeconds / 60 / plannedMinutes) * 100) : 0,
  );
  const isLive = timer?.mode === "FOCUS" && timer.status === "RUNNING";

  return (
    <div className="dashboard-card" aria-live="polite">
      <div className="dashboard-card-header">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-warning" />
          <h2 className="text-lg font-bold">{ar ? "إنجاز اليوم" : "Today's Study"}</h2>
        </div>
        {timer?.mode === "FOCUS" && (
          <span className={`dashboard-live-time ${isLive ? "running" : "paused"}`}>
            <Radio aria-hidden="true" />
            {isLive ? (ar ? "يُحدّث الآن" : "Updating live") : ar ? "متوقف مؤقتًا" : "Paused"}
          </span>
        )}
      </div>

      <div className="study-rhythm-body mt-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-1">
            <strong className="text-3xl font-mono font-extrabold text-foreground">
              {displayMinutes}:{String(displaySeconds).padStart(2, "0")}
            </strong>
            <span className="text-xs text-muted">
              / {targetMinutes} {ar ? "دقيقة" : "min"}
            </span>
          </div>
          <span className="text-xs font-bold font-mono text-primary">{progressPercent}%</span>
        </div>

        <div className="dashboard-progress mb-4">
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-line">
          <Pulse label={ar ? "الأسبوع" : "Week"} value={`${weekMinutes}${ar ? "د" : "m"}`} />
          <Pulse label={ar ? "مكتملة" : "Tasks"} value={String(completedWeek)} />
          <Pulse label={ar ? "التركيز" : "Focus"} value={averageScore == null ? "—" : String(averageScore)} accent />
        </div>
      </div>
    </div>
  );
}

function Pulse({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="p-2 rounded-md bg-surface-sunken border border-line">
      <span className="text-[11px] text-muted block font-semibold">{label}</span>
      <strong className={`text-sm font-mono font-bold ${accent ? "text-primary" : "text-foreground"}`}>
        {value}
      </strong>
    </div>
  );
}
