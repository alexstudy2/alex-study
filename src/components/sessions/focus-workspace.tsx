"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  Volume2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    new Date(props.initialServerNow).getTime() - Date.now()
  );
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reflection, setReflection] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [sound, setSound] = useState(props.preferences.ambientSound ?? "off");
  const audioContext = useRef<AudioContext | null>(null);
  const noiseNode = useRef<AudioNode | null>(null);

  const durationMinutes = useMemo(() => {
    if (mode === "SHORT_BREAK") return props.preferences.shortBreak;
    if (mode === "LONG_BREAK") return props.preferences.longBreak;
    return props.preferences.focus;
  }, [mode, props.preferences]);

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(handle);
  }, []);

  const remaining = useMemo(() => {
    if (!timer) return durationMinutes * 60;
    const segment =
      timer.status === "RUNNING" && timer.segmentStartedAt
        ? Math.max(0, Math.floor((now + serverOffset - new Date(timer.segmentStartedAt).getTime()) / 1000))
        : 0;
    const active = Math.min(
      timer.durationSeconds,
      timer.accumulatedActiveSeconds + segment
    );
    return Math.max(0, timer.durationSeconds - active);
  }, [timer, durationMinutes, now, serverOffset]);

  const toggleSound = useCallback(
    (type: string) => {
      setSound(type);
      if (type === "off") {
        noiseNode.current?.disconnect();
        noiseNode.current = null;
        return;
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContext.current) audioContext.current = new AudioCtx();
      const ctx = audioContext.current;
      if (ctx.state === "suspended") void ctx.resume();
      noiseNode.current?.disconnect();

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === "brown") {
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          output[i] = (lastOut + 0.08 * white) / 1.08;
          lastOut = output[i];
          output[i] *= 1.8;
        }
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      const gainNode = ctx.createGain();
      gainNode.gain.value = (props.preferences.ambientVolume / 100) * 0.2;
      whiteNoise.connect(gainNode);
      gainNode.connect(ctx.destination);
      whiteNoise.start();
      noiseNode.current = gainNode;
    },
    [props.preferences.ambientVolume]
  );

  useEffect(() => {
    return () => {
      noiseNode.current?.disconnect();
      if (audioContext.current?.state !== "closed") void audioContext.current?.close();
    };
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/timer/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        durationMinutes,
        taskId: taskId || null,
        subjectId: subjectId || null,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? t.error);
      return;
    }
    setTimer(data.timer);
    setServerOffset(new Date(data.serverNow).getTime() - Date.now());
  }

  async function act(action: "pause" | "resume" | "complete" | "cancel") {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/timer/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reflectionNotes: reflection || null }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? t.error);
      return;
    }
    setTimer(data.timer);
    if (data.serverNow) setServerOffset(new Date(data.serverNow).getTime() - Date.now());
    if (action === "complete" || action === "cancel") {
      setReflection("");
    }
  }

  async function distract() {
    if (!timer) return;
    const response = await fetch("/api/timer/distraction", { method: "POST" });
    if (response.ok) {
      const data = await response.json();
      setTimer(data.timer);
    }
  }

  return (
    <section className={`focus-grid ${focusMode ? "focus-mode-active" : ""}`}>
      <div className="timer-card">
        {!timer && (
          <div className="segmented-control" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "FOCUS"}
              onClick={() => setMode("FOCUS")}
            >
              {t.focus}
            </button>
            <button
              role="tab"
              aria-selected={mode === "SHORT_BREAK"}
              onClick={() => setMode("SHORT_BREAK")}
            >
              {t.short}
            </button>
            <button
              role="tab"
              aria-selected={mode === "LONG_BREAK"}
              onClick={() => setMode("LONG_BREAK")}
            >
              {t.long}
            </button>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="focus-mode-toggle"
          aria-pressed={focusMode}
          leftIcon={focusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          onClick={() => setFocusMode(!focusMode)}
        >
          {focusMode ? t.exitFocusMode : t.focusMode}
        </Button>
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
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={start}
              leftIcon={<Play className="w-5 h-5" />}
            >
              {t.start}
            </Button>
          )}
          {timer?.status === "RUNNING" && (
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => act("pause")}
              leftIcon={<Pause className="w-5 h-5" />}
            >
              {t.pause}
            </Button>
          )}
          {timer?.status === "PAUSED" && (
            <Button
              variant="primary"
              size="lg"
              disabled={busy}
              onClick={() => act("resume")}
              leftIcon={<Play className="w-5 h-5" />}
            >
              {t.resume}
            </Button>
          )}
          {timer && (
            <Button
              variant="secondary"
              size="lg"
              disabled={busy}
              onClick={() => act("complete")}
              leftIcon={<Check className="w-5 h-5" />}
            >
              {t.complete}
            </Button>
          )}
          {timer && (
            <Button
              variant="danger"
              size="icon"
              title={t.cancel}
              aria-label={t.cancel}
              disabled={busy}
              onClick={() => act("cancel")}
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>

        {timer?.mode === "FOCUS" && (
          <Button
            variant="ghost"
            size="sm"
            className="distraction-button mt-4"
            leftIcon={<AlertCircle className="w-4 h-4 text-warning" />}
            onClick={distract}
          >
            {t.distraction} · {timer.session?.distractionCount ?? 0}
          </Button>
        )}

        {timer?.mode === "FOCUS" && (
          <label className="reflection-field">
            <span>{t.reflection}</span>
            <textarea
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="Notes, key insights, or concepts to review..."
            />
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
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-muted" />
              {t.ambient}
            </span>
            <select value={sound} onChange={(event) => toggleSound(event.target.value)}>
              <option value="off">{t.soundOff}</option>
              <option value="rain">{t.soundRain}</option>
              <option value="brown">{t.soundBrown}</option>
            </select>
          </label>
          <Button
            href="/sessions"
            variant="secondary"
            size="sm"
            leftIcon={<History className="w-4 h-4" />}
          >
            {t.sessions}
          </Button>
        </aside>
      )}
    </section>
  );
}
