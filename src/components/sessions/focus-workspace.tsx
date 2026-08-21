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
  Minus,
  Plus,
  ClipboardList,
  Compass,
  SlidersHorizontal,
  Clock,
  Timer as TimerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ECG_PATH } from "@/components/ui/medical-doodles";
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
  /** Arriving from a task card's "Enter focus" (/focus?task=...). Pre-answers the assignment
   * gate with that task; ignored when a recovered timer is in charge of the form. */
  preselectedTaskId?: string | null;
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
    setup: "Session Setup",
    setupHint: "Pick what this session is for and how long it runs, then open the timer.",
    assignment: "Session assignment",
    assignTask: "Assign to a task",
    assignTaskHint: "Log this focus time against one task",
    independent: "Independent session",
    independentHint: "Study without linking a task",
    pickTask: "Choose a task…",
    taskRequired: "Choose a task, or switch to an independent session.",
    noTasks: "No open tasks yet",
    lengths: "Session & break length",
    openTimer: "Open focus timer",
    backToTimer: "Back to the timer",
    adjust: "Session setup",
    gate: "Assign a task or pick an independent session first.",
    decrease: "Decrease",
    increase: "Increase",
    close: "Close",
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
    setup: "تخصيص الجلسة",
    setupHint: "حدّد هدف الجلسة ومدتها، ثم افتح المؤقت.",
    assignment: "ربط الجلسة",
    assignTask: "ربط بمهمة",
    assignTaskHint: "احسب وقت التركيز على مهمة واحدة",
    independent: "جلسة مستقلة",
    independentHint: "ادرس بدون ربط أي مهمة",
    pickTask: "اختر مهمة…",
    taskRequired: "اختر مهمة، أو انتقل إلى جلسة مستقلة.",
    noTasks: "لا توجد مهام مفتوحة",
    lengths: "مدة الجلسة والراحات",
    openTimer: "افتح مؤقت التركيز",
    backToTimer: "رجوع إلى المؤقت",
    adjust: "إعداد الجلسة",
    gate: "اربط الجلسة بمهمة أو اختر جلسة مستقلة أولًا.",
    decrease: "إنقاص",
    increase: "زيادة",
    close: "إغلاق",
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

/* How long the dial is left alone to finish before the celebration card covers it. Paired
   with the 520ms ring fill and the 420ms check in components.css -- long enough that both
   land, short enough that it never reads as the app having hung. */
const FINISH_FLOURISH_MS = 700;

/* A session has to be pointed at something before it can start: one task, or an explicit
   "independent". The empty string is the unanswered state, which is why this is not a boolean --
   "no task chosen yet" and "deliberately no task" have to be told apart. */
type Assignment = "" | "TASK" | "INDEPENDENT";

/* Per-session lengths. The bounds mirror the Settings page's own validation
   (src/lib/settings/validation.ts) so the two surfaces cannot disagree about what a legal length
   is, and all of them sit inside the timer API's 1..240 minute window. Chosen here they override
   the saved defaults for this session only -- the numbers in Settings are what the page loads
   with, not something the timer quietly rewrites. */
const LENGTH_LIMITS = {
  FOCUS: { min: 5, max: 120, step: 5 },
  SHORT_BREAK: { min: 1, max: 30, step: 1 },
  LONG_BREAK: { min: 5, max: 60, step: 5 },
} as const;

type Limits = { min: number; max: number; step: number };

function clampMinutes(value: number, limits: Limits) {
  if (!Number.isFinite(value)) return limits.min;
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)));
}

function DurationStepper(props: {
  label: string;
  unit: string;
  unitLabel: string;
  value: number;
  limits: Limits;
  disabled: boolean;
  decrease: string;
  increase: string;
  onChange: (next: number) => void;
}) {
  const { limits, value } = props;
  return (
    <div className="focus-duration-row">
      <span className="focus-duration-name">{props.label}</span>
      <div className="focus-stepper">
        <button
          type="button"
          className="focus-stepper-btn"
          aria-label={`${props.decrease}: ${props.label}`}
          disabled={props.disabled || value <= limits.min}
          onClick={() => props.onChange(clampMinutes(value - limits.step, limits))}
        >
          <Minus aria-hidden="true" />
        </button>
        {/* Typed input is clamped on blur, not on every keystroke: clamping as you type turns
            "select all, type 30" into 5 and then 530 for any target whose first digit is below
            the minimum. Nothing downstream trusts this number -- the dial and the start request
            both read the clamped `lengths` -- so a transient out-of-range value is harmless. */}
        <input
          type="number"
          inputMode="numeric"
          className="focus-stepper-input"
          value={value}
          min={limits.min}
          max={limits.max}
          disabled={props.disabled}
          aria-label={`${props.label} (${props.unitLabel})`}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(next)) props.onChange(next);
          }}
          onBlur={() => props.onChange(clampMinutes(value, limits))}
        />
        <span className="focus-stepper-unit" aria-hidden="true">
          {props.unit}
        </span>
        <button
          type="button"
          className="focus-stepper-btn"
          aria-label={`${props.increase}: ${props.label}`}
          disabled={props.disabled || value >= limits.max}
          onClick={() => props.onChange(clampMinutes(value + limits.step, limits))}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function FocusWorkspace(props: Props) {
  const t = copy[props.locale];
  const [mode, setMode] = useState<TimerMode>(props.initialTimer?.mode ?? "FOCUS");
  const [timer, setTimer] = useState(props.initialTimer);
  const [taskId, setTaskId] = useState(
    props.initialTimer?.task?.id ?? props.preselectedTaskId ?? "",
  );
  const [subjectId, setSubjectId] = useState(
    props.initialTimer?.subject?.id ??
      /* The entered-with task's own course, so the session is fully aimed before anyone
         touches the form. */
      props.tasks.find((task) => task.id === props.preselectedTaskId)?.subjectId ??
      "",
  );
  /* A recovered timer has already answered the question, so it must not be sent back through the
     gate: a run with a task is a TASK session, one without is an independent one. A task arrived
     from a task card's "Enter focus" link counts as answered too -- that is the whole point of
     the link. */
  const [assignment, setAssignment] = useState<Assignment>(() =>
    props.initialTimer
      ? props.initialTimer.task
        ? "TASK"
        : "INDEPENDENT"
      : props.preselectedTaskId
        ? "TASK"
        : "",
  );
  const [durations, setDurations] = useState({
    focus: props.preferences.focus,
    shortBreak: props.preferences.shortBreak,
    longBreak: props.preferences.longBreak,
  });
  /* Phone-only in effect: the stylesheet turns the setup panel into a full window and hides the
     timer card while this is pending, and ignores it entirely at sidebar widths where both are
     already on screen. Held in React rather than behind a matchMedia listener so there is no
     hydration flash and one state drives both layouts. A recovered timer starts un-gated -- a
     running session must never be hidden behind a setup step. */
  const [setupPending, setSetupPending] = useState(!props.initialTimer);
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
  /* Guards the end-of-clock auto-complete: the 250ms clock re-renders four times a second while
     the request is in flight, and without it each render would fire another "complete" against
     an already-completing session. */
  const autoCompleteRef = useRef<string | null>(null);
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
      /* The summary card is on top and owns Escape while it is open -- see its own handler
         below. Without this guard one keypress would dismiss the card and leave fullscreen. */
      if (celebration) return;
      if (e.key === "Escape") {
        void exitFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusMode, exitFullscreen, celebration]);

  /* What will actually run, as opposed to what is currently in the three input boxes. Every
     consumer -- the dial, the "Dose" readout, the mode tabs and the start request -- reads these,
     so a half-typed length can never reach the server or the clock. */
  const lengths = useMemo(
    () => ({
      FOCUS: clampMinutes(durations.focus, LENGTH_LIMITS.FOCUS),
      SHORT_BREAK: clampMinutes(durations.shortBreak, LENGTH_LIMITS.SHORT_BREAK),
      LONG_BREAK: clampMinutes(durations.longBreak, LENGTH_LIMITS.LONG_BREAK),
    }),
    [durations],
  );
  const durationMinutes = lengths[mode];

  /* The gate. "Independent" is a real answer, so it opens it; "assign to a task" only counts once
     a task is actually picked, otherwise choosing that radio and walking away would start an
     unassigned session anyway. */
  const canStart =
    assignment === "INDEPENDENT" || (assignment === "TASK" && Boolean(taskId));

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
    { value: "FOCUS" as TimerMode, label: t.focus, minutes: lengths.FOCUS },
    { value: "SHORT_BREAK" as TimerMode, label: t.short, minutes: lengths.SHORT_BREAK },
    { value: "LONG_BREAK" as TimerMode, label: t.long, minutes: lengths.LONG_BREAK },
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
    /* Belt as well as braces: the button is disabled until the gate opens, but a stale keyboard
       activation or a future caller should not be able to slip an unassigned session past it. */
    if (!canStart) return;
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
      /* A fresh session is allowed to auto-complete again -- the guard is per session, not for
         the component's lifetime. */
      autoCompleteRef.current = null;
      /* The setup step is answered the moment a session is actually running. Matters if the
          window is narrowed mid-session: without this the phone layout would come back to a setup
          window standing in front of a live timer. */
      setSetupPending(false);
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
        setSetupPending(true);
      }
    } catch {
      setBusy(false);
      setError(t.error);
    }
  }

  /* The clock ran out, so the session ends itself. Nothing below watches for zero -- the dial
     used to sit at 0:00 forever and wait for a manual "Complete session", which is not what a
     timer is for. The same act("complete") a press would have taken runs here: the server marks
     the session COMPLETED, the flourish plays, and the summary card opens. The ref guard keeps
     the four-ticks-a-second clock from firing it twice while the request is in flight; breaks
     complete themselves the same way as focus sessions. */
  useEffect(() => {
    if (!timer || remaining > 0) return;
    if (timer.status !== "RUNNING" || busy || finishing || celebration) return;
    if (autoCompleteRef.current === timer.id) return;
    autoCompleteRef.current = timer.id;
    void act("complete");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, remaining, busy, finishing, celebration]);

  /* A useCallback because the Escape handler below lists it as a dependency: a plain function
     would be a new identity on every tick of the 250ms clock and re-bind the listener with it. */
  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    setReflection("");
    setTimer(null);
    /* Back to the setup step, which on a phone is the window standing in front of the timer. The
       assignment itself survives -- it was chosen deliberately and another round on the same task
       is the common next move -- unless that task was just marked done, in which case it has left
       the list and the choice has to be made again. */
    setSetupPending(true);
    if (taskCompleted) {
      setAssignment("");
      setTaskId("");
    }
  }, [taskCompleted]);

  /* Escape closes the summary card, matching its new close button. The fullscreen handler above
     bows out while this is open so one keypress cannot both dismiss the card and drop out of
     focus mode. */
  useEffect(() => {
    if (!celebration) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismissCelebration();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [celebration, dismissCelebration]);

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
      <div
        className={`focus-workspace-container ${focusMode ? "fullscreen-focus-active" : ""}`}
        /* Only ever "pending" while the setup panel is on screen to be answered: in fullscreen
           the panel is not rendered at all, and a phone that hid the timer card on its say-so
           would be left with a blank screen. */
        data-setup={!focusMode && setupPending ? "pending" : "done"}
      >
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
          {/* Two names, on purpose. `doodle-timer-card` is what every rule in components.css and
              the mobile comfort pass already keys on, so it stays -- removing it would be a
              rename across ~40 selectors for no behaviour change. `focus-timer-card` is the
              skin-neutral name the Atlas rules use, and it was already in the shared card
              family's selector list waiting for an element to carry it. */}
          <div className="doodle-timer-card focus-timer-card">
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

            {/* Reopens the setup window. Phone-only -- see the stylesheet: at sidebar widths the
                panel it opens is already on screen beside the dial, so the button would be a
                button that does nothing visible. Enabled during a run too, because the ambient
                sound control lives in there and is the one setting a session does not freeze. */}
            {!focusMode && (
              <button
                type="button"
                className="focus-setup-reopen"
                onClick={() => setSetupPending(true)}
              >
                <SlidersHorizontal aria-hidden="true" />
                {t.adjust}
              </button>
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
                  disabled={busy || !canStart}
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

            {/* Why "Start timer" is greyed out. Rendered rather than left to a tooltip because a
                disabled button explains nothing on a touch screen. */}
            {!timer && !canStart && <p className="timer-gate-hint">{t.gate}</p>}

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

          {/* 2. Session setup: a sidebar beside the dial on wide screens, a full window standing
              in front of it on a phone. One node either way -- rendering it twice would mean two
              copies of every control and a select whose value depends on which one you touched. */}
          {!focusMode && (
            <aside className="focus-sidebar-card" aria-label={t.setup}>
              <div className="sidebar-section-header pb-2 border-b-2 border-dashed border-line">
                <span className="font-extrabold text-sm text-foreground">{t.setup}</span>
              </div>

              <p className="focus-setup-hint">{t.setupHint}</p>

              <div className="focus-setup-body flex flex-col gap-3 mt-3">
                {/* The gate. Native radios inside the labels rather than buttons with
                    aria-checked: arrow-key navigation, the required-one-of-two semantics and the
                    grouping all come free, and the chip styling is driven from React state via
                    data-selected so none of it depends on :has(). */}
                <div className="focus-field" role="radiogroup" aria-label={t.assignment}>
                  <span className="focus-field-label">{t.assignment}</span>
                  <div className="focus-assign-options">
                    <label
                      className="focus-assign-option"
                      data-selected={assignment === "TASK"}
                      data-disabled={props.tasks.length === 0 || Boolean(timer)}
                    >
                      <input
                        type="radio"
                        name="focus-assignment"
                        value="TASK"
                        checked={assignment === "TASK"}
                        disabled={props.tasks.length === 0 || Boolean(timer)}
                        onChange={() => setAssignment("TASK")}
                      />
                      <ClipboardList aria-hidden="true" />
                      <span className="focus-assign-copy">
                        <strong>{t.assignTask}</strong>
                        <small>
                          {props.tasks.length === 0 ? t.noTasks : t.assignTaskHint}
                        </small>
                      </span>
                    </label>

                    <label
                      className="focus-assign-option"
                      data-selected={assignment === "INDEPENDENT"}
                      data-disabled={Boolean(timer)}
                    >
                      <input
                        type="radio"
                        name="focus-assignment"
                        value="INDEPENDENT"
                        checked={assignment === "INDEPENDENT"}
                        disabled={Boolean(timer)}
                        onChange={() => {
                          setAssignment("INDEPENDENT");
                          /* Independent means independent: a task left selected from a moment ago
                             would still be posted with the session. */
                          setTaskId("");
                        }}
                      />
                      <Compass aria-hidden="true" />
                      <span className="focus-assign-copy">
                        <strong>{t.independent}</strong>
                        <small>{t.independentHint}</small>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Only the task branch needs a task, so the select is only there for that branch
                    -- an independent session has nothing to pick from. */}
                {assignment === "TASK" && (
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
                      aria-invalid={!taskId}
                    >
                      <option value="">{t.pickTask}</option>
                      {props.tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    {!taskId && <small className="focus-field-note">{t.taskRequired}</small>}
                  </label>
                )}

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

                {/* Session and break lengths for this run. Frozen while a timer exists: the
                    duration is fixed server-side at start and the ring is drawn from it, so an
                    editable box would be a control that lies. */}
                <div className="focus-field">
                  <span className="focus-field-label flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-muted" />
                    {t.lengths}
                  </span>
                  <div className="focus-durations">
                    <DurationStepper
                      label={t.focus}
                      unit={t.minShort}
                      unitLabel={t.min}
                      value={durations.focus}
                      limits={LENGTH_LIMITS.FOCUS}
                      disabled={Boolean(timer)}
                      decrease={t.decrease}
                      increase={t.increase}
                      onChange={(next) => setDurations((current) => ({ ...current, focus: next }))}
                    />
                    <DurationStepper
                      label={t.short}
                      unit={t.minShort}
                      unitLabel={t.min}
                      value={durations.shortBreak}
                      limits={LENGTH_LIMITS.SHORT_BREAK}
                      disabled={Boolean(timer)}
                      decrease={t.decrease}
                      increase={t.increase}
                      onChange={(next) =>
                        setDurations((current) => ({ ...current, shortBreak: next }))
                      }
                    />
                    <DurationStepper
                      label={t.long}
                      unit={t.minShort}
                      unitLabel={t.min}
                      value={durations.longBreak}
                      limits={LENGTH_LIMITS.LONG_BREAK}
                      disabled={Boolean(timer)}
                      decrease={t.decrease}
                      increase={t.increase}
                      onChange={(next) =>
                        setDurations((current) => ({ ...current, longBreak: next }))
                      }
                    />
                  </div>
                </div>

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
              </div>

              {/* Outside the field stack, deliberately. In the phone window that stack is the only
                  thing that scrolls and this sits under it, always on screen: a footer *inside* the
                  scroller can only be held down with `position: sticky`, which lifts it off its own
                  place in the flow and prints it over whichever fields are at that height. */}
              <div className="focus-setup-footer">
                {/* The way out of the setup window, and the gate's enforcement point on a
                    phone: disabled until the session has been pointed at something. Always
                    enabled while a timer exists, so opening this mid-run cannot trap you. */}
                <Button
                  variant="primary"
                  size="md"
                  className="focus-setup-continue w-full justify-center"
                  disabled={!timer && !canStart}
                  onClick={() => setSetupPending(false)}
                  leftIcon={<TimerIcon className="w-4 h-4" />}
                >
                  {timer ? t.backToTimer : t.openTimer}
                </Button>

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
            </aside>
          )}
        </section>
      </div>

      {/* 3. Celebration & Reflection Overlay */}
      {celebration && (
        <div className="celebration-overlay">
          <div
            className="celebration-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebration-title"
          >
            {/* The card used to have three ways out, all of which also did something else. This
                one just closes it, which is what a stray "I have read this" tap wants. */}
            <button
              type="button"
              className="celebration-close-btn"
              onClick={dismissCelebration}
              title={`${t.close} (Esc)`}
              aria-label={t.close}
            >
              <X aria-hidden="true" />
            </button>
            <h2 id="celebration-title" className="text-xl font-extrabold text-foreground mb-2">
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
