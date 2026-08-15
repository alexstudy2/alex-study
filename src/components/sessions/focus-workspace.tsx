"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Clock3,
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
    complete: "Complete session",
    cancel: "Cancel",
    distraction: "I got distracted",
    task: "Associated Task",
    subject: "Study Course",
    none: "None",
    ambient: "Ambient sound",
    soundOff: "Off (Silent)",
    soundRain: "Rain",
    soundBrown: "Brown noise",
    reflection: "What helped you focus?",
    recovery: "Your timer was recovered from the server.",
    focusMode: "Full Screen Focus",
    exitFocusMode: "Exit Full Screen",
    sessions: "Session history",
    error: "The timer could not be updated. Please try again.",
    celebrationTitle: "Great session completed!",
    min: "min",
    distractionsCount: "distractions",
    startAnother: "Start another session",
    markTaskDone: "Mark task as done",
    taskDone: "Completed!",
    viewSessions: "View sessions",
    ready: "Ready when you are",
    running: "Session in progress",
    paused: "Timer paused",
    remaining: "remaining",
  },
  ar: {
    focus: "تركيز",
    short: "راحة قصيرة",
    long: "راحة طويلة",
    start: "ابدأ المؤقت",
    pause: "إيقاف مؤقت",
    resume: "متابعة",
    complete: "إنهاء الجلسة",
    cancel: "إلغاء",
    distraction: "تشتت انتباهي",
    task: "المهمة المرتبطة",
    subject: "المقرر الدراسي",
    none: "بدون",
    ambient: "الصوت المحيط",
    soundOff: "متوقف",
    soundRain: "صوت المطر",
    soundBrown: "ضوضاء بنية",
    reflection: "ما الذي ساعدك على التركيز؟",
    recovery: "تمت استعادة المؤقت من الخادم.",
    focusMode: "ملء الشاشة",
    exitFocusMode: "إنهاء ملء الشاشة",
    sessions: "سجل الجلسات",
    error: "تعذر تحديث المؤقت. يرجى المحاولة مجددًا.",
    celebrationTitle: "أحسنت! اكتملت الجلسة بنجاح",
    min: "دقيقة",
    distractionsCount: "تشتت",
    startAnother: "ابدأ جلسة أخرى",
    markTaskDone: "إنجاز المهمة",
    taskDone: "تم الإنجاز!",
    viewSessions: "سجل الجلسات",
    ready: "جاهز عندما تكون مستعدًا",
    running: "الجلسة قيد التشغيل",
    paused: "المؤقت متوقف مؤقتًا",
    remaining: "متبقي",
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
  const [clientStartedAt] = useState(() => new Date().getTime());
  const [serverOffset, setServerOffset] = useState(
    () => new Date(props.initialServerNow).getTime() - clientStartedAt
  );
  const [now, setNow] = useState(clientStartedAt);
  const [busy, setBusy] = useState(false);
  const [distractionBusy, setDistractionBusy] = useState(false);
  const [distractionConfirmed, setDistractionConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [reflection, setReflection] = useState("");
  const [celebration, setCelebration] = useState<{
    duration: number;
    distractions: number;
    taskTitle?: string;
    taskId?: string;
    subjectName?: string;
  } | null>(null);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [sound, setSound] = useState(props.preferences.ambientSound ?? "off");
  const audioContext = useRef<AudioContext | null>(null);
  const noiseNode = useRef<AudioNode | null>(null);

  const enterFullscreen = useCallback(async () => {
    setFocusMode(true);
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fallback to CSS overlay if native Fullscreen API is blocked
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setFocusMode(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFullscreen = Boolean(document.fullscreenElement);
      if (!isNativeFullscreen && focusMode) {
        setFocusMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusMode, exitFullscreen]);

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
  const totalSeconds = timer?.durationSeconds ?? durationMinutes * 60;
  const elapsedPercent = Math.min(
    100,
    Math.max(0, ((totalSeconds - remaining) / Math.max(1, totalSeconds)) * 100),
  );

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
    try {
      const response = await fetch("/api/timer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          durationSeconds: durationMinutes * 60,
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
    } catch {
      setBusy(false);
      setError(t.error);
    }
  }

  async function act(action: "pause" | "resume" | "complete" | "cancel") {
    if (!timer) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/timer/${timer.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version: timer.version,
          reflection: reflection || undefined,
        }),
      });
      const data = await response.json();
      setBusy(false);
      if (!response.ok) {
        setError(data.error ?? t.error);
        return;
      }
      setTimer(data.timer);
      if (data.serverNow) setServerOffset(new Date(data.serverNow).getTime() - Date.now());

      if (action === "complete") {
        setCelebration({
          duration: data.timer.durationSeconds - remaining,
          distractions: data.timer.session?.distractionCount ?? 0,
          taskTitle: data.timer.task?.title,
          taskId: data.timer.task?.id,
          subjectName: data.timer.subject?.name,
        });
        setTaskCompleted(false);
      }

      if (action === "cancel") {
        setReflection("");
        setTimer(null);
      }
    } catch {
      setBusy(false);
      setError(t.error);
    }
  }

  function dismissCelebration() {
    setCelebration(null);
    setReflection("");
    setTimer(null);
  }

  async function completeLinkedTask() {
    if (!celebration?.taskId) return;
    try {
      const response = await fetch(`/api/tasks/${celebration.taskId}/complete`, { method: "POST" });
      if (response.ok) setTaskCompleted(true);
      else setError(t.error);
    } catch {
      setError(t.error);
    }
  }

  async function distract() {
    if (!timer || distractionBusy) return;
    setDistractionBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/timer/${timer.id}/distractions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: null }),
      });
      if (response.ok) {
        const data = (await response.json()) as { distractionCount: number };
        setTimer((current) =>
          current?.session
            ? { ...current, session: { ...current.session, distractionCount: data.distractionCount } }
            : current,
        );
        setDistractionConfirmed(true);
        window.setTimeout(() => setDistractionConfirmed(false), 1200);
      } else setError(t.error);
    } catch {
      setError(t.error);
    } finally {
      setDistractionBusy(false);
    }
  }

  return (
    <>
      <div className={`focus-workspace-container ${focusMode ? "fullscreen-focus-active" : ""}`}>
        {/* Sticky Note Exit Button (Visible only in Fullscreen) */}
        {focusMode && (
          <button
            type="button"
            className="fullscreen-exit-sticky-btn group"
            onClick={exitFullscreen}
            title={`${t.exitFocusMode} (Esc)`}
            aria-label={`${t.exitFocusMode} (Esc)`}
          >
            <span className="sticky-tape" aria-hidden="true" />
            <Minimize2 className="w-5 h-5 text-secondary transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
            <span className="fullscreen-exit-tooltip">{t.exitFocusMode}</span>
          </button>
        )}

        <section className="focus-main-grid">
          {/* 1. Master Timer Card */}
          <div className="doodle-timer-card">
            {/* Mode Switcher Tabs (Only when timer is stopped) */}
            {!timer && (
              <div className="timer-mode-segmented-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "FOCUS"}
                  onClick={() => setMode("FOCUS")}
                  className={`timer-mode-tab ${mode === "FOCUS" ? "active" : ""}`}
                >
                  {t.focus} ({props.preferences.focus}m)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "SHORT_BREAK"}
                  onClick={() => setMode("SHORT_BREAK")}
                  className={`timer-mode-tab ${mode === "SHORT_BREAK" ? "active" : ""}`}
                >
                  {t.short} ({props.preferences.shortBreak}m)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "LONG_BREAK"}
                  onClick={() => setMode("LONG_BREAK")}
                  className={`timer-mode-tab ${mode === "LONG_BREAK" ? "active" : ""}`}
                >
                  {t.long} ({props.preferences.longBreak}m)
                </button>
              </div>
            )}

            {/* Fullscreen Toggle Button (in non-fullscreen mode) */}
            {!focusMode && (
              <Button
                variant="ghost"
                size="sm"
                className="fullscreen-trigger-btn"
                leftIcon={<Maximize2 className="w-4 h-4" />}
                onClick={enterFullscreen}
              >
                {t.focusMode}
              </Button>
            )}

            <div className="timer-status-row">
              <p className="timer-active-mode-label">
                {mode === "FOCUS" ? t.focus : mode === "SHORT_BREAK" ? t.short : t.long}
              </p>
              <span className={`timer-live-status ${timer?.status?.toLowerCase() ?? "ready"}`}>
                <i aria-hidden="true" />
                {!timer ? t.ready : timer.status === "PAUSED" ? t.paused : t.running}
              </span>
            </div>

            <div
              className="timer-dial"
              style={{ "--timer-progress": `${elapsedPercent * 3.6}deg` } as React.CSSProperties}
            >
              <div className="timer-dial-inner">
                <Clock3 aria-hidden="true" />
                <output className="giant-timer-digits" aria-label={`${formatClock(remaining)} ${t.remaining}`}>
                  {formatClock(remaining)}
                </output>
                <span>{t.remaining}</span>
              </div>
            </div>

            {/* Context: Linked task / subject */}
            {timer?.task && (
              <p className="timer-context-pill">
                <span className="font-semibold text-xs text-muted">{t.task}:</span> {timer.task.title}
              </p>
            )}
            {timer?.subject && (
              <p className="timer-context-pill">
                <span className="font-semibold text-xs text-muted">{t.subject}:</span> {timer.subject.name}
              </p>
            )}

            {/* Timer Actions Bar */}
            <div className="timer-action-buttons">
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

            {/* Distraction Counter Button */}
            {timer?.mode === "FOCUS" && (
              <button
                type="button"
                className={`doodle-distraction-btn mt-4 ${distractionConfirmed ? "confirmed" : ""}`}
                onClick={distract}
                disabled={distractionBusy || busy}
                aria-busy={distractionBusy}
              >
                <span className="distraction-button-icon">
                  {distractionConfirmed ? <Check aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
                </span>
                <span className="distraction-button-copy">
                  <strong>{t.distraction}</strong>
                  <small>{props.locale === "ar" ? "سجّل اللحظة وارجع للتركيز" : "Log it, then return to focus"}</small>
                </span>
                <span className="distraction-counter-badge">
                  {distractionBusy ? "…" : timer.session?.distractionCount ?? 0}
                </span>
              </button>
            )}

            {error && (
              <p className="text-xs font-bold text-danger mt-3" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* 2. Side Settings Card (Hidden in Fullscreen) */}
          {!focusMode && (
            <aside className="focus-sidebar-card">
              <div className="sidebar-section-header pb-2 border-b-2 border-dashed border-line">
                <span className="font-extrabold text-sm text-foreground">
                  {props.locale === "ar" ? "تخصيص الجلسة" : "Session Setup"}
                </span>
              </div>

              <div className="flex flex-col gap-3 mt-3">
                <label className="focus-field">
                  <span className="focus-field-label">{t.task}</span>
                  <select
                    disabled={Boolean(timer)}
                    value={taskId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTaskId(value);
                      const task = props.tasks.find((item) => item.id === value);
                      if (task?.subjectId) setSubjectId(task.subjectId);
                    }}
                    className="focus-select"
                  >
                    <option value="">{t.none}</option>
                    {props.tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="focus-field">
                  <span className="focus-field-label">{t.subject}</span>
                  <select
                    disabled={Boolean(timer)}
                    value={subjectId}
                    onChange={(event) => setSubjectId(event.target.value)}
                    className="focus-select"
                  >
                    <option value="">{t.none}</option>
                    {props.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="focus-field">
                  <span className="focus-field-label flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-muted" />
                    {t.ambient}
                  </span>
                  <select
                    value={sound}
                    onChange={(event) => toggleSound(event.target.value)}
                    className="focus-select"
                  >
                    <option value="off">{t.soundOff}</option>
                    <option value="rain">{t.soundRain}</option>
                    <option value="brown">{t.soundBrown}</option>
                  </select>
                </label>

                <div className="pt-2 border-t border-line">
                  <Button
                    href="/sessions"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center"
                    leftIcon={<History className="w-4 h-4" />}
                  >
                    {t.sessions}
                  </Button>
                </div>
              </div>
            </aside>
          )}
        </section>
      </div>

      {/* 3. Celebration & Reflection Overlay */}
      {celebration && (
        <div className="celebration-overlay">
          <div className="celebration-card">
            <h2 className="text-xl font-extrabold text-foreground mb-2">
              {t.celebrationTitle}
            </h2>
            <div className="celebration-stats">
              <span className="stat-pill">
                {Math.round(celebration.duration / 60)} {t.min}
              </span>
              <span className="stat-pill">
                {celebration.distractions} {t.distractionsCount}
              </span>
              {celebration.subjectName && (
                <span className="stat-pill">{celebration.subjectName}</span>
              )}
            </div>

            <label className="reflection-field mt-4 flex flex-col gap-1 text-start">
              <span className="text-xs font-bold text-foreground">{t.reflection}</span>
              <textarea
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder="What went well? Any concepts to review next time..."
                className="doodle-input resize-none"
                rows={3}
              />
            </label>

            <div className="celebration-actions mt-4 flex items-center justify-end gap-2 flex-wrap">
              {celebration.taskId && !taskCompleted && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={completeLinkedTask}
                  leftIcon={<Check className="w-4 h-4" />}
                >
                  {t.markTaskDone}
                </Button>
              )}
              {celebration.taskId && taskCompleted && (
                <Button
                  variant="secondary"
                  size="md"
                  disabled
                  leftIcon={<Check className="w-4 h-4 text-success" />}
                >
                  {t.taskDone}
                </Button>
              )}
              <Button
                variant="primary"
                size="md"
                onClick={dismissCelebration}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                {t.startAnother}
              </Button>
              <Button
                href="/sessions"
                variant="ghost"
                size="md"
                onClick={dismissCelebration}
                leftIcon={<History className="w-4 h-4" />}
              >
                {t.viewSessions}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
