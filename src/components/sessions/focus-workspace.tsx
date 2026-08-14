"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { TimerMode, TimerRun } from "./types";

type Option = {
  id: string;
  name?: string;
  title?: string;
  colorToken?: string;
  subjectId?: string | null;
};
type Props = {
  locale: "en" | "ar";
  preferences: {
    focus: number;
    shortBreak: number;
    longBreak: number;
    ambientSound: string | null;
    ambientVolume: number;
  };
  tasks: Option[];
  subjects: Option[];
  initialTimer: TimerRun | null;
  initialServerNow: string;
};

const copy = {
  en: {
    focus: "Focus",
    short: "Short break",
    long: "Long break",
    start: "Start timer",
    pause: "Pause",
    resume: "Resume",
    complete: "Complete",
    cancel: "Cancel",
    distraction: "I got distracted",
    task: "Task",
    subject: "Subject",
    none: "None",
    ambient: "Ambient sound",
    soundOff: "Off",
    soundRain: "Rain",
    soundBrown: "Brown noise",
    reflection: "What helped you focus?",
    recovery: "Your timer was recovered from the server.",
    focusMode: "Focus mode",
    exitFocusMode: "Exit focus mode",
    sessions: "Session history",
    error: "The timer could not be updated. Refresh and try again.",
  },
  ar: {
    focus: "تركيز",
    short: "راحة قصيرة",
    long: "راحة طويلة",
    start: "ابدأ المؤقت",
    pause: "إيقاف مؤقت",
    resume: "متابعة",
    complete: "إنهاء",
    cancel: "إلغاء",
    distraction: "تشتت انتباهي",
    task: "المهمة",
    subject: "المادة",
    none: "بدون",
    ambient: "الصوت المحيط",
    soundOff: "متوقف",
    soundRain: "مطر",
    soundBrown: "ضوضاء بنية",
    reflection: "ما الذي ساعدك على التركيز؟",
    recovery: "تمت استعادة المؤقت من الخادم.",
    focusMode: "وضع التركيز",
    exitFocusMode: "إنهاء وضع التركيز",
    sessions: "سجل الجلسات",
    error: "تعذر تحديث المؤقت. حدّث الصفحة وحاول مجددًا.",
  },
};

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

export function FocusWorkspace(props: Props) {
  const t = copy[props.locale];
  const [mode, setMode] = useState<TimerMode>(props.initialTimer?.mode ?? "FOCUS");
  const [timer, setTimer] = useState(props.initialTimer);
  const [taskId, setTaskId] = useState(props.initialTimer?.task?.id ?? "");
  const [subjectId, setSubjectId] = useState(props.initialTimer?.subject?.id ?? "");
  const [serverOffset, setServerOffset] = useState(
    new Date(props.initialServerNow).getTime() - Date.now(),
  );
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reflection, setReflection] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [sound, setSound] = useState(props.preferences.ambientSound ?? "off");
  const audioRef = useRef<AudioContext | null>(null);

  const duration =
    mode === "FOCUS"
      ? props.preferences.focus * 60
      : mode === "SHORT_BREAK"
        ? props.preferences.shortBreak * 60
        : props.preferences.longBreak * 60;
  const remaining = useMemo(() => {
    if (!timer) return duration;
    const segment =
      timer.status === "RUNNING" && timer.segmentStartedAt
        ? Math.max(
            0,
            Math.floor((now + serverOffset - new Date(timer.segmentStartedAt).getTime()) / 1000),
          )
        : 0;
    return Math.max(0, timer.durationSeconds - timer.accumulatedActiveSeconds - segment);
  }, [duration, now, serverOffset, timer]);

  useEffect(() => {
    if (!timer || timer.status !== "RUNNING") return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (timer && remaining === 0 && timer.status === "RUNNING") void act("complete");
    // Completion is intentionally keyed to the derived server countdown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, timer?.status]);

  const applyResponse = useCallback((payload: { timer: TimerRun; serverNow: string }) => {
    setTimer(
      payload.timer.status === "COMPLETED" || payload.timer.status === "CANCELLED"
        ? null
        : payload.timer,
    );
    setServerOffset(new Date(payload.serverNow).getTime() - Date.now());
    setNow(Date.now());
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/timer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        durationSeconds: duration,
        taskId: taskId || null,
        subjectId: subjectId || null,
      }),
    });
    const payload = await response.json();
    if (response.ok) applyResponse(payload);
    else setError(t.error);
    setBusy(false);
  }

  async function act(action: "pause" | "resume" | "complete" | "cancel") {
    if (!timer || busy) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/timer/${timer.id}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        version: timer.version,
        reflection: action === "complete" ? reflection : undefined,
      }),
    });
    const payload = await response.json();
    if (response.ok) {
      applyResponse(payload);
      if (action === "complete") setReflection("");
    } else setError(t.error);
    setBusy(false);
  }

  async function distract() {
    if (!timer) return;
    const response = await fetch(`/api/timer/${timer.id}/distractions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (response.ok && timer.session)
      setTimer({
        ...timer,
        session: { ...timer.session, distractionCount: timer.session.distractionCount + 1 },
      });
  }

  function toggleSound(value: string) {
    setSound(value);
    audioRef.current?.close();
    audioRef.current = null;
    if (value === "off") return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = value === "rain" ? "sine" : "triangle";
    oscillator.frequency.value = value === "rain" ? 180 : 90;
    gain.gain.value = Math.min(0.04, props.preferences.ambientVolume / 2500);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    audioRef.current = context;
  }

  return (
    <section
      className={`focus-workspace${focusMode ? " is-focus-mode" : ""}`}
      dir={props.locale === "ar" ? "rtl" : "ltr"}
    >
      {props.initialTimer && (
        <p className="recovery-note" role="status">
          {t.recovery}
        </p>
      )}
      <div className="mode-tabs" role="tablist" aria-label="Timer mode">
        {(["FOCUS", "SHORT_BREAK", "LONG_BREAK"] as TimerMode[]).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={mode === item}
            disabled={Boolean(timer)}
            onClick={() => setMode(item)}
          >
            {item === "FOCUS" ? t.focus : item === "SHORT_BREAK" ? t.short : t.long}
          </button>
        ))}
      </div>
      <div className="timer-stage">
        <button
          className="focus-mode-toggle"
          type="button"
          aria-pressed={focusMode}
          onClick={() => setFocusMode(!focusMode)}
        >
          {focusMode ? t.exitFocusMode : t.focusMode}
        </button>
        <p className="timer-mode-label">
          {mode === "FOCUS" ? t.focus : mode === "SHORT_BREAK" ? t.short : t.long}
        </p>
        <output className="timer-digits" aria-live="off">
          {formatClock(remaining)}
        </output>
        {timer?.task && <p className="timer-context">{timer.task.title}</p>}
        {timer?.subject && <p className="timer-context">{timer.subject.name}</p>}
        <div className="timer-actions">
          {!timer && (
            <button className="primary-button" disabled={busy} onClick={start}>
              {t.start}
            </button>
          )}
          {timer?.status === "RUNNING" && (
            <button className="primary-button" disabled={busy} onClick={() => act("pause")}>
              {t.pause}
            </button>
          )}
          {timer?.status === "PAUSED" && (
            <button className="primary-button" disabled={busy} onClick={() => act("resume")}>
              {t.resume}
            </button>
          )}
          {timer && (
            <button className="secondary-button" disabled={busy} onClick={() => act("complete")}>
              {t.complete}
            </button>
          )}
          {timer && (
            <button
              className="timer-icon-button"
              title={t.cancel}
              aria-label={t.cancel}
              disabled={busy}
              onClick={() => act("cancel")}
            >
              ×
            </button>
          )}
        </div>
        {timer?.mode === "FOCUS" && (
          <button className="distraction-button" onClick={distract}>
            {t.distraction} · {timer.session?.distractionCount ?? 0}
          </button>
        )}
        {timer?.mode === "FOCUS" && (
          <label className="reflection-field">
            <span>{t.reflection}</span>
            <textarea value={reflection} onChange={(event) => setReflection(event.target.value)} />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!focusMode && (
        <aside className="focus-settings">
          <label>
            <span>{t.task}</span>
            <select
              disabled={Boolean(timer)}
              value={taskId}
              onChange={(event) => {
                const value = event.target.value;
                setTaskId(value);
                const task = props.tasks.find((item) => item.id === value);
                if (task?.subjectId) setSubjectId(task.subjectId);
              }}
            >
              <option value="">{t.none}</option>
              {props.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.subject}</span>
            <select
              disabled={Boolean(timer)}
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              <option value="">{t.none}</option>
              {props.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.ambient}</span>
            <select value={sound} onChange={(event) => toggleSound(event.target.value)}>
              <option value="off">{t.soundOff}</option>
              <option value="rain">{t.soundRain}</option>
              <option value="brown">{t.soundBrown}</option>
            </select>
          </label>
          <Link className="secondary-button" href="/sessions">
            {t.sessions}
          </Link>
        </aside>
      )}
    </section>
  );
}
