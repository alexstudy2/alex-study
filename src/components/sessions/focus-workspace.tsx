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
  Stethoscope,
  HeartPulse,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedicalArtClinic, MedicalArtLab } from "./medical-art";
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
    done: "Session complete",
    remaining: "remaining",
    minShort: "m",
    chart: "Focus chart",
    dose: "Dose",
    progress: "Progress",
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
    done: "اكتملت الجلسة",
    remaining: "متبقي",
    minShort: "د",
    chart: "بطاقة التركيز",
    dose: "الجرعة",
    progress: "التقدم",
  },
};

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}

/* The ring lives in a 0..100 viewBox; r=46 with a 5-unit stroke puts its outer edge at
   48.5, so nothing is cropped. The circumference is computed rather than declared with
   `pathLength="100"` -- that attribute is the tidier form but Safari has a long history
   of ignoring it on <circle>, and a silently unscaled dash array means a ring that never
   moves. */
const RING_RADIUS = 46;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/* Gauge graduations, drawn as two dashed circles rather than seventy-two <line> elements: a
   dash pattern laid around a circle already *is* a ring of radial ticks. `stroke-width` is the
   tick's radial length and the dash length is its tangential width, so the only arithmetic is
   one division -- circumference over count, less the ink, is the gap.

   Both rings are built outwards from a shared outer edge so the long and short graduations
   line up on the same rim; that is why the major ring, being the longer tick, sits at the
   smaller radius. A <circle> starts its dash pattern at 3 o'clock and runs clockwise, and both
   30 and 6 divide 90, so the graduations land on the clock positions without a rotation. */
const TICK_RIM = 42.6;
function gauge(count: number, length: number, ink: number) {
  const r = TICK_RIM - length / 2;
  return {
    r,
    strokeWidth: length,
    strokeDasharray: `${ink} ${(2 * Math.PI * r) / count - ink}`,
  };
}
const TICKS_MINOR = gauge(60, 2.2, 0.7);
const TICKS_MAJOR = gauge(12, 4.4, 1.5);

/* One cardiac cycle on a baseline of 20 in a 40-unit-tall box: a flat segment, the small P
   bump, the QRS spike, then the broad T wave. Eight of them make a 480-unit strip that the
   stylesheet scrolls leftwards by exactly half its own width -- 240 units is four whole beats,
   so the window it scrolls through is identical at both ends of the loop and there is no seam
   to hide. The beat is a function rather than eight hand-written copies because the seam only
   holds while every beat is the same width. */
function ecgBeat(x: number) {
  return (
    `L${x + 8} 20 Q${x + 13} 12 ${x + 18} 20 L${x + 23} 20 L${x + 26} 25 L${x + 30} 4` +
    ` L${x + 34} 31 L${x + 37} 20 L${x + 44} 20 Q${x + 50} 11 ${x + 56} 20 L${x + 60} 20`
  );
}
const ECG_BEATS = 8;
const ECG_PATH = `M0 20 ${Array.from({ length: ECG_BEATS }, (_, i) => ecgBeat(i * 60)).join(" ")}`;

/* How long the dial is left alone to finish before the celebration card covers it. Paired
   with the 520ms ring fill and the 420ms check in components.css -- long enough that both
   land, short enough that it never reads as the app having hung. */
const FINISH_FLOURISH_MS = 700;

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
  /* The window between "the session is over" and "here is the summary card", during which
     the dial fills itself and stamps a check. Purely presentational -- the request has
     already succeeded by the time this is true. */
  const [finishing, setFinishing] = useState(false);
  const finishTimeout = useRef<number | null>(null);
  const [sound, setSound] = useState(props.preferences.ambientSound ?? "off");
  const audioContext = useRef<AudioContext | null>(null);
  const noiseNode = useRef<AudioNode | null>(null);

  useEffect(
    () => () => {
      if (finishTimeout.current !== null) window.clearTimeout(finishTimeout.current);
    },
    [],
  );

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
  /* The flourish fills the ring regardless of where it had got to: "Complete session" is
     also how you end a session early, and a ring frozen at 40% is a poor full stop. */
  const ringProgress = finishing ? 1 : elapsedPercent / 100;
  const dialStatus = !timer
    ? "ready"
    : timer.status === "PAUSED"
      ? "paused"
      : timer.status === "RUNNING"
        ? "running"
        : "done";
  const clock = formatClock(remaining);
  /* The two readouts under the dial. Both are already implicit in the ring and the digits;
     they are here because a gauge with a printed scale beside it reads as an instrument, and
     because "how long is this session" is otherwise only visible before you start it. */
  const doseMinutes = Math.round(totalSeconds / 60);
  const progressLabel = `${Math.round(elapsedPercent)}%`;

  const modeTabs = [
    { value: "FOCUS" as TimerMode, label: t.focus, minutes: props.preferences.focus },
    { value: "SHORT_BREAK" as TimerMode, label: t.short, minutes: props.preferences.shortBreak },
    { value: "LONG_BREAK" as TimerMode, label: t.long, minutes: props.preferences.longBreak },
  ];
  const activeTabIndex = Math.max(
    0,
    modeTabs.findIndex((tab) => tab.value === mode),
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
        const summary = {
          duration: data.timer.durationSeconds - remaining,
          distractions: data.timer.session?.distractionCount ?? 0,
          taskTitle: data.timer.task?.title,
          taskId: data.timer.task?.id,
          subjectName: data.timer.subject?.name,
        };
        setTaskCompleted(false);
        /* Read at the moment of the action rather than held in state: this is the only
           place the preference is needed, and a media query listener for it would be more
           machinery than one boolean deserves. With reduced motion there is no flourish to
           wait for, so the card must not be delayed either. */
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          setCelebration(summary);
        } else {
          setFinishing(true);
          finishTimeout.current = window.setTimeout(() => {
            finishTimeout.current = null;
            setCelebration(summary);
            setFinishing(false);
          }, FINISH_FLOURISH_MS);
        }
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
          {/* The illustrated panels that flank the dial. They exist only in fullscreen -- there
              is no room for them beside the setup sidebar, and rendering them anyway to hide
              them with CSS would mean twenty always-mounted icons on a page that already has a
              per-second render. The stylesheet also drops them below the width where the
              middle column would have to give up space to make room. */}
          {focusMode && <MedicalArtClinic />}

          {/* 1. Master Timer Card */}
          <div className="doodle-timer-card">
            {/* Chart header: the badge that makes the card read as a patient chart rather than
                a generic panel. Decorative twin of the mode label below it, so the icon is
                hidden and the text is the accessible name of nothing -- it is a heading. */}
            <p className="timer-chart-head">
              <span className="timer-chart-badge" aria-hidden="true">
                <Activity />
              </span>
              {t.chart}
            </p>

            {/* Mode Switcher Tabs (Only when timer is stopped) */}
            {!timer && (
              <div className="timer-mode-segmented-tabs" role="tablist">
                {/* The pill slides between the three cells; the tabs themselves only change
                    colour. It sits before them in the DOM so it paints underneath without
                    needing a z-index on every tab. `--tab-index` is set here rather than on
                    the parent because a child's transform must not be driven by a variable
                    on an ancestor -- the variable would inherit into every descendant and
                    any of them could pick it up by accident. */}
                <span
                  className="timer-mode-indicator"
                  aria-hidden="true"
                  style={{ "--tab-index": activeTabIndex } as React.CSSProperties}
                />
                {modeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.value}
                    onClick={() => setMode(tab.value)}
                    className="timer-mode-tab"
                  >
                    <span className="timer-mode-tab-name">{tab.label}</span>
                    <span className="timer-mode-tab-mins">
                      {tab.minutes}
                      {t.minShort}
                    </span>
                  </button>
                ))}
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
              <span className={`timer-live-status ${dialStatus}`}>
                <i aria-hidden="true" />
                {dialStatus === "ready"
                  ? t.ready
                  : dialStatus === "paused"
                    ? t.paused
                    : dialStatus === "done"
                      ? t.done
                      : t.running}
              </span>
            </div>

            {/* `key` restarts the entrance animation on exactly the two events that deserve
                one -- starting a session and cancelling back to idle -- without a class to
                add and then remove. */}
            <div
              key={timer?.id ?? "idle"}
              className="timer-dial"
              data-status={dialStatus}
              data-finishing={finishing ? "on" : "off"}
            >
              {/* Replaces a conic-gradient, which had to repaint the whole 19rem circle on
                  every tick. `rotate(-90 50 50)` is an attribute, not CSS, so the element's
                  transform stays available to the breathing animation. Clockwise in RTL too:
                  clocks do not mirror. */}
              <svg className="timer-ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle className="timer-ring-track" cx="50" cy="50" r={RING_RADIUS} />
                {/* Graduations inside the ring, on the annulus between it and the plate. Two
                    dashed circles; see the gauge() helper for how a dash array becomes ticks. */}
                <circle className="timer-gauge timer-gauge-minor" cx="50" cy="50" {...TICKS_MINOR} />
                <circle className="timer-gauge timer-gauge-major" cx="50" cy="50" {...TICKS_MAJOR} />
                <circle
                  className="timer-ring-progress"
                  cx="50"
                  cy="50"
                  r={RING_RADIUS}
                  transform="rotate(-90 50 50)"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - ringProgress)}
                />
              </svg>
              <div className="timer-dial-inner">
                {finishing ? (
                  <Check className="timer-dial-check" aria-hidden="true" />
                ) : dialStatus === "ready" ? (
                  <Stethoscope aria-hidden="true" />
                ) : (
                  /* Beats while the session runs and holds still while it is paused, which is
                     the same information the status pill carries in words. */
                  <HeartPulse className="timer-dial-pulse" aria-hidden="true" />
                )}
                <output className="giant-timer-digits" aria-label={`${clock} ${t.remaining}`}>
                  {/* The digit cells are decorative scaffolding for the roll animation, so
                      they are hidden and one plain string is left for assistive tech --
                      otherwise `role="status"` would announce the clock character by
                      character. Keeping real text (not just the label) is what makes the
                      live region fire at all when the value changes. */}
                  <span className="sr-only">{clock}</span>
                  {clock.split("").map((ch, index) =>
                    ch === ":" ? (
                      <span key={`sep-${index}`} className="timer-digit-sep" aria-hidden="true">
                        :
                      </span>
                    ) : (
                      <span key={`digit-${index}`} className="timer-digit" aria-hidden="true">
                        {/* Keyed on the character: React remounts this span only when the
                            digit actually changes, which is what makes the animation run
                            per-digit instead of on all four every second. */}
                        <span key={ch} className="timer-digit-value">
                          {ch}
                        </span>
                      </span>
                    ),
                  )}
                </output>
                {/* The monitor trace. One static path in a clipping window that the stylesheet
                    slides sideways -- a transform on a composited layer rather than anything
                    redrawn per frame, and the only element in the plate that is pure texture. */}
                <span className="timer-ecg" aria-hidden="true">
                  <svg viewBox="0 0 480 40" preserveAspectRatio="none">
                    <path className="timer-ecg-line" d={ECG_PATH} />
                  </svg>
                </span>
                <span>{t.remaining}</span>
              </div>
            </div>

            {/* Printed scale beside the gauge. `direction: ltr` on the values, not the row: the
                labels are translated and belong in the reading order, the numbers do not. */}
            <dl className="timer-vitals">
              <div className="timer-vital">
                <dt>{t.dose}</dt>
                <dd>
                  {doseMinutes}
                  {t.minShort}
                </dd>
              </div>
              <div className="timer-vital">
                <dt>{t.progress}</dt>
                <dd>{progressLabel}</dd>
              </div>
            </dl>

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

          {focusMode && <MedicalArtLab />}

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
