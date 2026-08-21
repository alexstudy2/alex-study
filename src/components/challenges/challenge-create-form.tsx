"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  Clock,
  Info,
  ListChecks,
  Search,
  Send,
  Swords,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";

type Person = { id: string; name: string; academicYear: number };
type Subject = { id: string; name: string; normalizedName: string };

const DAY = 86_400_000;
/** Both mirror `challengeInputSchema`; the composer refuses locally what the API would refuse. */
const MAX_DAYS = 31;
const BOUNDS = { task: { min: 1, max: 100 }, time: { min: 10, max: 20_000 } };

/** `datetime-local` wants wall-clock time, and `toISOString()` is UTC. */
function localInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const TYPES = [
  {
    value: "TASK_COUNT",
    icon: ListChecks,
    label: { en: "Tasks", ar: "المهام" },
    help: {
      en: "Eligible tasks across all subjects",
      ar: "مهام مؤهلة في كل المواد",
    },
  },
  {
    value: "STUDY_TIME",
    icon: Timer,
    label: { en: "Study time", ar: "وقت الدراسة" },
    help: { en: "Minutes from timer-based sessions", ar: "دقائق من جلسات المؤقت" },
  },
  {
    value: "SUBJECT_TASK_COUNT",
    icon: BookOpen,
    label: { en: "Subject tasks", ar: "مهام مادة" },
    help: { en: "Eligible tasks for one subject", ar: "مهام مؤهلة لمادة واحدة" },
  },
  {
    value: "SUBJECT_STUDY_TIME",
    icon: Clock,
    label: { en: "Subject time", ar: "وقت مادة" },
    help: { en: "Study minutes for one subject", ar: "دقائق دراسة لمادة واحدة" },
  },
] as const;

const RESOLUTIONS = [
  {
    value: "TARGET_FIRST",
    icon: Target,
    label: { en: "First to target", ar: "الأول إلى الهدف" },
    help: {
      en: "Ends the moment one of you reaches the target.",
      ar: "ينتهي عند وصول أحدكما إلى الهدف.",
    },
  },
  {
    value: "DEADLINE_LEADER",
    icon: Trophy,
    label: { en: "Leader at deadline", ar: "المتصدر عند الموعد" },
    help: {
      en: "Runs the full duration; a draw is possible.",
      ar: "يستمر حتى نهاية المدة، والتعادل ممكن.",
    },
  },
] as const;

const DURATIONS = [3, 7, 14, 30];
const TASK_PRESETS = [3, 5, 10, 20];
const TIME_PRESETS = [60, 120, 300, 600];

const COPY = {
  en: {
    eyebrow: "Challenge composer",
    title: "Agree on a goal that is easy to audit",
    description:
      "Your friend sees the target, the eligibility rules, how it resolves and how long it runs before accepting.",
    back: "All challenges",
    cancel: "Cancel",
    submit: "Send invitation",
    sending: "Sending…",
    stepOpponent: "Opponent",
    askOpponent: "Who is joining you?",
    filterFriends: "Filter friends",
    filterPlaceholder: "Type a name…",
    noFilterMatch: "No friend matched that name.",
    busyWith: "Open challenge",
    stepMeasure: "Measure",
    askMeasure: "What are you trying to build?",
    subject: "Subject",
    noSubjects: "Create a subject from Tasks first.",
    stepTarget: "Target",
    askTarget: "How much will you aim for?",
    tasksLabel: "Eligible tasks",
    minutesLabel: "Eligible minutes",
    stepResolution: "Resolution",
    askResolution: "How should it be decided?",
    stepSchedule: "Schedule",
    askSchedule: "When does it run?",
    starts: "Starts",
    ends: "Ends",
    summaryTitle: "What your friend will see",
    pickFriend: "No friend selected",
    tasksSummary: (n: number) => `${n} eligible tasks`,
    minutesSummary: (n: number) => `${n} eligible minutes`,
    daysSummary: (n: number) => (n === 1 ? "1 day" : `${n} days`),
    rulesTitle: "Before you send",
    rules:
      "Short tasks and manual sessions do not count. If a source is edited or deleted the result is recalculated with a visible adjustment event.",
    order: "The end must come after the start.",
    tooLong: `A challenge can run for at most ${MAX_DAYS} days.`,
    invalidDates: "Fill in both dates.",
    outOfRange: (min: number, max: number) => `Pick a number between ${min} and ${max}.`,
    emptyTitle: "Add a friend first",
    emptyBody: "One-to-one challenges are available only between accepted friends.",
    emptyCta: "Open friends",
    errors: {
      self_challenge: "You cannot challenge yourself.",
      opponent_not_friend: "You can only challenge an accepted friend.",
      active_pair_challenge: "You already have an open challenge with this friend.",
      invalid_subject: "Choose one of your active subjects for this challenge.",
      schedule: "Check the start and end dates.",
      targetValue: "That target is outside the allowed range.",
      unauthorized: "Your session expired. Sign in again.",
      generic: "Review the details and try again.",
    },
    year: (year: number) => `Year ${year}`,
  },
  ar: {
    eyebrow: "منشئ التحدي",
    title: "اتفقا على هدف واضح وقابل للتحقق",
    description: "سيرى صديقك الهدف وقواعد الأهلية وطريقة الحسم والمدة قبل القبول.",
    back: "كل التحديات",
    cancel: "إلغاء",
    submit: "إرسال الدعوة",
    sending: "جارٍ الإرسال…",
    stepOpponent: "الصديق",
    askOpponent: "من يشاركك التحدي؟",
    filterFriends: "تصفية الأصدقاء",
    filterPlaceholder: "اكتب اسمًا…",
    noFilterMatch: "لا صديق بهذا الاسم.",
    busyWith: "تحدٍ مفتوح",
    stepMeasure: "المقياس",
    askMeasure: "ماذا تريد أن تبني؟",
    subject: "المادة",
    noSubjects: "أنشئ مادة أولًا من صفحة المهام.",
    stepTarget: "الهدف",
    askTarget: "كم تريد أن تنجز؟",
    tasksLabel: "عدد المهام",
    minutesLabel: "الدقائق",
    stepResolution: "الحسم",
    askResolution: "كيف تُحسم النتيجة؟",
    stepSchedule: "المدة",
    askSchedule: "متى يبدأ وينتهي؟",
    starts: "البداية",
    ends: "النهاية",
    summaryTitle: "ما سيراه صديقك",
    pickFriend: "لم تختر صديقًا",
    tasksSummary: (n: number) => `${n} مهمة مؤهلة`,
    minutesSummary: (n: number) => `${n} دقيقة مؤهلة`,
    daysSummary: (n: number) => (n === 1 ? "يوم واحد" : `${n} يومًا`),
    rulesTitle: "قبل الإرسال",
    rules:
      "المهام القصيرة والجلسات اليدوية لا تُحتسب. إذا عُدّل مصدر أو حُذف تُعاد النتيجة تلقائيًا مع حدث تسوية ظاهر.",
    order: "يجب أن تكون النهاية بعد البداية.",
    tooLong: `أقصى مدة للتحدي ${MAX_DAYS} يومًا.`,
    invalidDates: "أدخل التاريخين.",
    outOfRange: (min: number, max: number) => `اختر رقمًا بين ${min} و${max}.`,
    emptyTitle: "أضف صديقًا أولًا",
    emptyBody: "التحديات الفردية متاحة بين الأصدقاء المقبولين فقط.",
    emptyCta: "فتح الأصدقاء",
    errors: {
      self_challenge: "لا يمكنك تحدي نفسك.",
      opponent_not_friend: "يمكنك تحدي الأصدقاء المقبولين فقط.",
      active_pair_challenge: "يوجد بالفعل تحدٍ مفتوح بينكما.",
      invalid_subject: "اختر مادة نشطة من موادك لهذا التحدي.",
      schedule: "راجع تاريخي البداية والنهاية.",
      targetValue: "الهدف خارج النطاق المسموح.",
      unauthorized: "انتهت الجلسة. سجّل الدخول من جديد.",
      generic: "راجع التفاصيل وحاول مرة أخرى.",
    },
    year: (year: number) => `السنة ${year}`,
  },
} as const;

export function ChallengeCreateForm({
  locale,
  friends,
  subjects,
  preselectedOpponentId = "",
  openChallengeByFriend = {},
}: {
  locale: "en" | "ar";
  friends: Person[];
  subjects: Subject[];
  /** From `/challenges/new?opponent=…`, the link a friend card sends you here with. */
  preselectedOpponentId?: string;
  /** `createChallenge` allows one open challenge per pair, so those friends are not selectable. */
  openChallengeByFriend?: Record<string, string>;
}) {
  const ar = locale === "ar";
  const t = COPY[locale];
  const router = useRouter();
  const available = useMemo(
    () => friends.filter((friend) => !openChallengeByFriend[friend.id]),
    [friends, openChallengeByFriend],
  );
  const initialStart = useMemo(() => new Date(), []);
  const [opponentId, setOpponentId] = useState(
    available.some((friend) => friend.id === preselectedOpponentId)
      ? preselectedOpponentId
      : (available[0]?.id ?? ""),
  );
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<string>("TASK_COUNT");
  const [resolutionType, setResolutionType] = useState<string>("TARGET_FIRST");
  const [targetValue, setTargetValue] = useState(5);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(localInput(initialStart));
  const [endsAt, setEndsAt] = useState(localInput(new Date(initialStart.getTime() + 7 * DAY)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const subjectType = type.startsWith("SUBJECT_");
  const taskType = type.includes("TASK_COUNT");
  const bounds = taskType ? BOUNDS.task : BOUNDS.time;
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  const days = Math.round((endMs - startMs) / DAY);
  /* The API rejects all three of these, and it used to be the only thing that did -- you filled the
     form, sent it, and got "Review the details and try again" with no idea which detail. */
  const scheduleProblem = !Number.isFinite(startMs)
    ? t.invalidDates
    : !Number.isFinite(endMs)
      ? t.invalidDates
      : endMs <= startMs
        ? t.order
        : endMs - startMs > MAX_DAYS * DAY
          ? t.tooLong
          : "";
  const targetProblem =
    targetValue >= bounds.min && targetValue <= bounds.max
      ? ""
      : t.outOfRange(bounds.min, bounds.max);
  const opponent = friends.find((friend) => friend.id === opponentId);
  const shown = filter.trim()
    ? available.filter((friend) => friend.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : available;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          opponentId,
          type,
          resolutionType,
          targetValue,
          subjectId: subjectType ? subjectId : null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        router.push(`/challenges/${payload.challenge.id}`);
        return;
      }
      /* Every rejection the API can send now has its own sentence. `fields.challenge` carries the
         service's own codes; the rest are zod field errors, which only ever named the field. */
      const fields: Record<string, string[] | undefined> = payload?.fields ?? {};
      const errors: Record<string, string> = t.errors;
      const code = fields.challenge?.[0] ?? "";
      setMessage(
        response.status === 401
          ? errors.unauthorized
          : (errors[code] ??
            (fields.subjectId
              ? errors.invalid_subject
              : fields.targetValue
                ? errors.targetValue
                : fields.startsAt || fields.endsAt
                  ? errors.schedule
                  : fields.opponentId
                    ? errors.opponent_not_friend
                    : errors.generic)),
      );
    } catch {
      setMessage(t.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      icon={Swords}
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      backHref="/challenges"
      backLabel={t.back}
      isRtl={ar}
    />
  );

  if (!friends.length)
    return (
      <PageShell size="narrow" dir={ar ? "rtl" : "ltr"} className="challenge-composer-page">
        {header}
        <section className="challenge-empty challenge-form-empty">
          <h2>{t.emptyTitle}</h2>
          <p>{t.emptyBody}</p>
          <Button href="/friends" variant="primary" leftIcon={<Users className="w-4 h-4" />}>
            {t.emptyCta}
          </Button>
        </section>
      </PageShell>
    );

  return (
    <PageShell size="narrow" dir={ar ? "rtl" : "ltr"} className="challenge-composer-page">
      {header}
      <form className="challenge-composer" onSubmit={submit}>
        <section className="composer-section">
          <div className="composer-step">
            <span aria-hidden="true">01</span>
            <div>
              <p className="eyebrow">{t.stepOpponent}</p>
              <h2>{t.askOpponent}</h2>
            </div>
          </div>
          {/* A filter only earns its place once the picker is long enough to scroll past. */}
          {available.length > 6 && (
            <label className="composer-filter">
              <Search className="w-4 h-4" aria-hidden="true" />
              <span className="sr-only">{t.filterFriends}</span>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t.filterPlaceholder}
                autoComplete="off"
              />
            </label>
          )}
          <div
            className="opponent-picker"
            role="radiogroup"
            aria-label={t.askOpponent}
            data-empty={shown.length ? undefined : "true"}
          >
            {shown.map((friend) => (
              <label key={friend.id}>
                <input
                  type="radio"
                  name="opponent"
                  value={friend.id}
                  checked={opponentId === friend.id}
                  onChange={() => setOpponentId(friend.id)}
                />
                <span className="friend-avatar" data-year={friend.academicYear} aria-hidden="true">
                  {friend.name.trim().slice(0, 1).toUpperCase() || "?"}
                </span>
                <strong>{friend.name}</strong>
                <small>{t.year(friend.academicYear)}</small>
              </label>
            ))}
            {!shown.length && <p className="composer-hint">{t.noFilterMatch}</p>}
          </div>
          {/* Friends you already share a challenge with, named rather than silently missing. */}
          {friends.length > available.length && (
            <p className="composer-hint">
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {t.busyWith}:{" "}
                {friends
                  .filter((friend) => openChallengeByFriend[friend.id])
                  .map((friend) => friend.name)
                  .join(ar ? "، " : ", ")}
              </span>
            </p>
          )}
        </section>

        <section className="composer-section">
          <div className="composer-step">
            <span aria-hidden="true">02</span>
            <div>
              <p className="eyebrow">{t.stepMeasure}</p>
              <h2>{t.askMeasure}</h2>
            </div>
          </div>
          <div
            className="challenge-choice-grid"
            role="radiogroup"
            aria-label={t.askMeasure}
          >
            {TYPES.map((option) => {
              /* A subject challenge with no subject to name is unsubmittable, and the old form let
                 you pick one anyway and then failed on the server with `invalid_subject`. */
              const blocked = option.value.startsWith("SUBJECT_") && !subjects.length;
              return (
                <label key={option.value} data-disabled={blocked ? "true" : undefined}>
                  <input
                    type="radio"
                    name="type"
                    value={option.value}
                    checked={type === option.value}
                    disabled={blocked}
                    onChange={() => {
                      setType(option.value);
                      setTargetValue(option.value.includes("TASK_COUNT") ? 5 : 120);
                    }}
                  />
                  <option.icon className="w-4 h-4" aria-hidden="true" />
                  <strong>{option.label[locale]}</strong>
                  <small>{blocked ? t.noSubjects : option.help[locale]}</small>
                </label>
              );
            })}
          </div>
          {subjectType && subjects.length > 0 && (
            <label className="composer-field">
              <span>{t.subject}</span>
              <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} required>
                {subjects.map((subject) => (
                  <option value={subject.id} key={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <section className="composer-split">
          <div className="composer-section">
            <div className="composer-step">
              <span aria-hidden="true">03</span>
              <div>
                <p className="eyebrow">{t.stepTarget}</p>
                <h2>{t.askTarget}</h2>
              </div>
            </div>
            <label className="composer-field target-field">
              <span>{taskType ? t.tasksLabel : t.minutesLabel}</span>
              <input
                type="number"
                inputMode="numeric"
                min={bounds.min}
                max={bounds.max}
                value={targetValue}
                onChange={(event) => setTargetValue(Number(event.target.value))}
                aria-invalid={targetProblem ? true : undefined}
                required
              />
            </label>
            <div className="composer-presets">
              {(taskType ? TASK_PRESETS : TIME_PRESETS).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className="composer-preset"
                  aria-pressed={targetValue === preset}
                  onClick={() => setTargetValue(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            {targetProblem && <p className="composer-warning">{targetProblem}</p>}
          </div>
          <div className="composer-section">
            <div className="composer-step">
              <span aria-hidden="true">04</span>
              <div>
                <p className="eyebrow">{t.stepResolution}</p>
                <h2>{t.askResolution}</h2>
              </div>
            </div>
            <div className="resolution-picker" role="radiogroup" aria-label={t.askResolution}>
              {RESOLUTIONS.map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="resolution"
                    value={option.value}
                    checked={resolutionType === option.value}
                    onChange={() => setResolutionType(option.value)}
                  />
                  <span>
                    <strong>
                      <option.icon className="w-4 h-4" aria-hidden="true" />
                      {option.label[locale]}
                    </strong>
                    <small>{option.help[locale]}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="composer-section">
          <div className="composer-step">
            <span aria-hidden="true">05</span>
            <div>
              <p className="eyebrow">{t.stepSchedule}</p>
              <h2>{t.askSchedule}</h2>
            </div>
          </div>
          {/* Nobody wants to type an end date. The presets set it from the start. */}
          <div className="composer-presets">
            {DURATIONS.map((preset) => (
              <button
                type="button"
                key={preset}
                className="composer-preset"
                aria-pressed={days === preset}
                onClick={() => {
                  const from = Number.isFinite(startMs) ? startMs : Date.now();
                  if (!Number.isFinite(startMs)) setStartsAt(localInput(new Date(from)));
                  setEndsAt(localInput(new Date(from + preset * DAY)));
                }}
              >
                {t.daysSummary(preset)}
              </button>
            ))}
          </div>
          <div className="composer-date-grid">
            <label className="composer-field">
              <span>{t.starts}</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                required
              />
            </label>
            <label className="composer-field">
              <span>{t.ends}</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                aria-invalid={scheduleProblem ? true : undefined}
                required
              />
            </label>
          </div>
          {scheduleProblem && <p className="composer-warning">{scheduleProblem}</p>}
        </section>

        {/* The invitation in one sentence, updating as the form changes -- the thing the opponent
            actually receives, which the five steps never showed back to you. */}
        <aside className="composer-summary">
          <strong>{t.summaryTitle}</strong>
          <ul>
            <li>
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>{opponent?.name ?? t.pickFriend}</span>
            </li>
            <li>
              <Target className="w-4 h-4" aria-hidden="true" />
              <span>
                {taskType ? t.tasksSummary(targetValue) : t.minutesSummary(targetValue)}
                {subjectType && subjects.length
                  ? ` · ${subjects.find((subject) => subject.id === subjectId)?.name ?? ""}`
                  : ""}
              </span>
            </li>
            <li>
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>
                {RESOLUTIONS.find((option) => option.value === resolutionType)?.label[locale]}
              </span>
            </li>
            <li>
              <CalendarRange className="w-4 h-4" aria-hidden="true" />
              <span>{scheduleProblem ? "—" : t.daysSummary(Math.max(days, 1))}</span>
            </li>
          </ul>
        </aside>

        <aside className="composer-rules">
          <strong>
            <Info className="w-4 h-4" aria-hidden="true" />
            {t.rulesTitle}
          </strong>
          <p>{t.rules}</p>
        </aside>

        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <div className="composer-actions">
          <Button href="/challenges" variant="secondary">
            {t.cancel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={busy}
            leftIcon={<Send className="w-4 h-4" />}
            disabled={
              !opponentId ||
              (subjectType && !subjectId) ||
              Boolean(scheduleProblem) ||
              Boolean(targetProblem)
            }
          >
            {busy ? t.sending : t.submit}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
