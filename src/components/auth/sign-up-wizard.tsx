"use client";

import { FormEvent, Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  Eye,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  Field,
  PasswordField,
  PasswordStrength,
  SelectField,
  Stepper,
  ToggleRow,
} from "@/components/auth/fields";
import { academicYearLabel, academicYearOptions } from "@/components/auth/academic-year";
import { STUDY_MOODS } from "@/components/ui/study-background-selector";
import { applyMood, moodToEnum, type StudyMood } from "@/lib/settings/study-mood";
import { writeLocaleCookie } from "@/lib/i18n/locale-cookie";
import {
  FOCUS_MINUTES,
  LONG_BREAK_MINUTES,
  RHYTHM_PRESETS,
  SHORT_BREAK_MINUTES,
} from "@/lib/settings/limits";

type Locale = "en" | "ar";

/**
 * Everything the three steps collect, in one object.
 *
 * One state object rather than one useState per field is what makes Back free: the steps
 * unmount, the draft does not, so returning to step 1 finds every input exactly as it was.
 */
type Draft = {
  name: string;
  collegeId: string;
  academicYear: string;
  email: string;
  password: string;
  confirm: string;
  locale: "EN" | "AR";
  studyMood: StudyMood;
  focus: number;
  shortBreak: number;
  longBreak: number;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  accountabilityNotifications: boolean;
  challengeNotifications: boolean;
  aiInsightNotifications: boolean;
  shareFullNameOnCards: boolean;
};

/* Defaults mirror the column defaults on UserPreference, via lib/settings/limits.ts. */
const EMPTY_DRAFT: Draft = {
  name: "",
  collegeId: "",
  academicYear: "1",
  email: "",
  password: "",
  confirm: "",
  locale: "EN",
  studyMood: "notebook",
  focus: FOCUS_MINUTES.default,
  shortBreak: SHORT_BREAK_MINUTES.default,
  longBreak: LONG_BREAK_MINUTES.default,
  emailNotifications: true,
  inAppNotifications: true,
  accountabilityNotifications: true,
  challengeNotifications: true,
  aiInsightNotifications: true,
  shareFullNameOnCards: false,
};

const COPY = {
  en: {
    steps: ["Your account", "How you study", "Review"],
    stepAria: (n: number, total: number) => `Step ${n} of ${total}`,
    name: "Full name",
    collegeId: "College ID",
    collegeIdPlaceholder: "e.g. 20-1234",
    collegeIdHint: "Used only to sign in. Never shown publicly.",
    year: "Academic year",
    email: "Recovery email (optional)",
    emailHint: "The only way to reset your own password. Skip it and a reset needs an admin.",
    password: "Password",
    passwordHint: "At least 8 characters.",
    confirm: "Confirm password",
    show: "Show password",
    hide: "Hide password",
    strength: ["Too short", "Weak", "Fair", "Good", "Strong"],
    accountTitle: "Start with the essentials",
    accountLede: "Your college ID and year are how you sign in — there is no username.",
    themeTitle: "Pick your study mood",
    themeLede: "Tap one to see it. You can change it any time in Settings.",
    langTitle: "Language",
    langHint: "Applies from your first sign-in.",
    rhythmTitle: "Focus rhythm",
    rhythmLede: "The default lengths for a focus block and its breaks.",
    presets: { classic: "Classic", deep: "Deep work", gentle: "Gentle" },
    focusLabel: "Focus block",
    shortLabel: "Short break",
    longLabel: "Long break",
    minutes: "min",
    less: "Decrease",
    more: "Increase",
    notifTitle: "Notifications & privacy",
    notifLede: "All optional, all changeable later.",
    notif: {
      email: ["Email me", "Summaries and reminders by email"],
      inApp: ["In-app notifications", "The bell in the top bar"],
      accountability: ["Accountability nudges", "When a study partner is waiting"],
      challenge: ["Challenge updates", "Results and new invitations"],
      ai: ["AI study insights", "Weekly observations about your habits"],
      shareName: ["Show my full name", "On leaderboards and shared cards. Off = first name only."],
    },
    reviewTitle: "One last look",
    reviewLede: "Create the account and everything below is ready on your first sign-in.",
    review: {
      name: "Name",
      collegeId: "College ID",
      year: "Year",
      email: "Recovery email",
      mood: "Study mood",
      language: "Language",
      rhythm: "Rhythm",
      notifications: "Notifications",
      leaderboard: "Leaderboard name",
    },
    notSet: "Not set",
    rhythmValue: (f: number, s: number, l: number) => `${f} / ${s} / ${l} min`,
    notifValue: (on: number, total: number) => `${on} of ${total} on`,
    fullName: "Full name",
    firstNameOnly: "First name only",
    finePrint:
      "By creating an account you agree that your study data is stored so the app can show you your own progress. Nothing is shared with other students unless you turn it on.",
    back: "Back",
    next: "Next",
    create: "Create account",
    creating: "Creating account...",
    errName: "Please enter at least 3 characters.",
    errCollegeId: "Letters, numbers and dashes only.",
    errEmail: "That does not look like an email address.",
    errPassword: "At least 8 characters.",
    errConfirm: "The two passwords do not match.",
    errTaken: "This college ID or email is already registered.",
    errRate: "Too many sign-up attempts from this network. Try again in an hour.",
    errGeneric: "Please review your details and try again.",
    errOffline: "Could not reach the server. Check your connection and try again.",
  },
  ar: {
    steps: ["حسابك", "طريقة مذاكرتك", "المراجعة"],
    stepAria: (n: number, total: number) => `الخطوة ${n} من ${total}`,
    name: "الاسم الكامل",
    collegeId: "الرقم الجامعي",
    collegeIdPlaceholder: "مثال: 20-1234",
    collegeIdHint: "يستخدم للدخول فقط ولا يظهر علنا.",
    year: "السنة الدراسية",
    email: "بريد الاستعادة (اختياري)",
    emailHint: "الطريقة الوحيدة لاستعادة كلمة المرور بنفسك. بدونه تحتاج مساعدة الإدارة.",
    password: "كلمة المرور",
    passwordHint: "8 أحرف على الأقل.",
    confirm: "تأكيد كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    strength: ["قصيرة جدا", "ضعيفة", "مقبولة", "جيدة", "قوية"],
    accountTitle: "لنبدأ بالأساسيات",
    accountLede: "الرقم الجامعي والسنة هما وسيلة الدخول، لا يوجد اسم مستخدم.",
    themeTitle: "اختر أجواء المذاكرة",
    themeLede: "اضغط أي واحدة لتراها الآن. يمكنك تغييرها لاحقا من الإعدادات.",
    langTitle: "اللغة",
    langHint: "تطبق من أول تسجيل دخول.",
    rhythmTitle: "إيقاع التركيز",
    rhythmLede: "المدة الافتراضية لجلسة التركيز واستراحاتها.",
    presets: { classic: "كلاسيكي", deep: "تركيز عميق", gentle: "هادئ" },
    focusLabel: "جلسة التركيز",
    shortLabel: "استراحة قصيرة",
    longLabel: "استراحة طويلة",
    minutes: "دقيقة",
    less: "تقليل",
    more: "زيادة",
    notifTitle: "التنبيهات والخصوصية",
    notifLede: "كلها اختيارية وقابلة للتغيير لاحقا.",
    notif: {
      email: ["تنبيهات البريد", "ملخصات وتذكيرات على بريدك"],
      inApp: ["تنبيهات داخل التطبيق", "الجرس في الشريط العلوي"],
      accountability: ["تنبيهات الالتزام", "عندما ينتظرك شريك مذاكرة"],
      challenge: ["تحديثات التحديات", "النتائج والدعوات الجديدة"],
      ai: ["تحليلات AI للمذاكرة", "ملاحظات أسبوعية عن عاداتك"],
      shareName: ["إظهار اسمي الكامل", "في لوحة الصدارة والبطاقات. عند الإيقاف يظهر الاسم الأول فقط."],
    },
    reviewTitle: "نظرة أخيرة",
    reviewLede: "أنشئ الحساب وكل ما يلي سيكون جاهزا من أول دخول.",
    review: {
      name: "الاسم",
      collegeId: "الرقم الجامعي",
      year: "السنة",
      email: "بريد الاستعادة",
      mood: "أجواء المذاكرة",
      language: "اللغة",
      rhythm: "الإيقاع",
      notifications: "التنبيهات",
      leaderboard: "الاسم في الصدارة",
    },
    notSet: "غير محدد",
    rhythmValue: (f: number, s: number, l: number) => `${f} / ${s} / ${l} دقيقة`,
    notifValue: (on: number, total: number) => `${on} من ${total} مفعلة`,
    fullName: "الاسم الكامل",
    firstNameOnly: "الاسم الأول فقط",
    finePrint:
      "بإنشاء الحساب أنت توافق على تخزين بيانات مذاكرتك حتى يعرض لك التطبيق تقدمك. لا تشارك أي بيانات مع الطلاب الآخرين إلا إذا فعلت ذلك بنفسك.",
    back: "رجوع",
    next: "التالي",
    create: "إنشاء الحساب",
    creating: "جار إنشاء الحساب...",
    errName: "أدخل 3 أحرف على الأقل.",
    errCollegeId: "حروف وأرقام وشرطات فقط.",
    errEmail: "هذا لا يبدو بريدا إلكترونيا صحيحا.",
    errPassword: "8 أحرف على الأقل.",
    errConfirm: "كلمتا المرور غير متطابقتين.",
    errTaken: "الرقم الجامعي أو البريد مستخدم بالفعل.",
    errRate: "محاولات تسجيل كثيرة من هذه الشبكة. حاول بعد ساعة.",
    errGeneric: "راجع البيانات وحاول مرة أخرى.",
    errOffline: "تعذر الوصول للسيرفر. تحقق من الاتصال وحاول مرة أخرى.",
  },
};
/* Deliberately not `as const`: the two locales have to stay interchangeable, and literal
   string types would make the Arabic copy unassignable wherever the English shape is named. */

const STEP_ICONS = [UserRound, Palette, Check] as const;
const NOTIFICATION_KEYS = [
  "emailNotifications",
  "inAppNotifications",
  "accountabilityNotifications",
  "challengeNotifications",
  "aiInsightNotifications",
] as const;

/* The same rules the server applies (lib/auth/validation.ts), so a Next that passes here is
   not rejected two steps later. The server stays the authority -- this only saves the trip. */
function accountErrors(draft: Draft, t: typeof COPY.en) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (draft.name.trim().length < 3) errors.name = t.errName;
  if (!/^[A-Za-z0-9-]{1,32}$/.test(draft.collegeId.trim())) errors.collegeId = t.errCollegeId;
  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
    errors.email = t.errEmail;
  if (draft.password.length < 8) errors.password = t.errPassword;
  if (draft.confirm !== draft.password) errors.confirm = t.errConfirm;
  return errors;
}

export function SignUpWizard({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const t = COPY[ar ? "ar" : "en"];
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT, locale: ar ? "AR" : "EN" });
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const errors = accountErrors(draft, t);
  const errorFor = (key: keyof Draft) => (showErrors ? errors[key] : undefined);

  function goTo(target: number) {
    /* Forward out of step 1 only with a clean account step; Back is always allowed. */
    if (target > 1 && step === 1 && Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setError("");
    setStep(target);
  }

  function previewMood(mood: StudyMood) {
    set("studyMood", mood);
    /* Preview only -- `saveMood` would PATCH /api/me/preferences and 401 for a visitor with
       no account yet. The choice travels with the registration payload instead. */
    applyMood(mood);
  }

  function applyPreset(preset: (typeof RHYTHM_PRESETS)[number]) {
    setDraft((current) => ({
      ...current,
      focus: preset.focus,
      shortBreak: preset.shortBreak,
      longBreak: preset.longBreak,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    /* One <form> wraps all three steps, so Enter inside a step-1 field lands here too.
       Treat it as the Next it was meant to be rather than as a half-filled submit. */
    if (step < 3) {
      goTo(step + 1);
      return;
    }
    setPending(true);
    setError("");
    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          collegeId: draft.collegeId.trim(),
          academicYear: Number(draft.academicYear),
          email: draft.email.trim(),
          password: draft.password,
          locale: draft.locale,
          preferences: {
            studyMood: moodToEnum(draft.studyMood),
            defaultFocusMinutes: draft.focus,
            defaultShortBreakMinutes: draft.shortBreak,
            defaultLongBreakMinutes: draft.longBreak,
            emailNotifications: draft.emailNotifications,
            inAppNotifications: draft.inAppNotifications,
            accountabilityNotifications: draft.accountabilityNotifications,
            challengeNotifications: draft.challengeNotifications,
            aiInsightNotifications: draft.aiInsightNotifications,
            shareFullNameOnCards: draft.shareFullNameOnCards,
          },
        }),
      });
    } catch {
      setPending(false);
      setError(t.errOffline);
      return;
    }
    if (!response.ok) {
      setPending(false);
      if (response.status === 409) {
        /* The clash is always a step-1 field, so send them back to the field that has it. */
        setError(t.errTaken);
        setShowErrors(true);
        setStep(1);
        return;
      }
      /* 429 gets its own message: "review your details" is actively misleading when the
         details were fine and the rate limiter (5/hr) is what refused. */
      setError(response.status === 429 ? t.errRate : t.errGeneric);
      if (response.status === 400) setStep(1);
      return;
    }
    /* Keep the redirect and the cookie write from the old form: the sign-in page the user
       lands on should already be in the language they just picked. */
    writeLocaleCookie(draft.locale);
    router.push("/sign-in?registered=1");
  }

  const activePreset = RHYTHM_PRESETS.find(
    (preset) =>
      preset.focus === draft.focus &&
      preset.shortBreak === draft.shortBreak &&
      preset.longBreak === draft.longBreak,
  );
  const mood = STUDY_MOODS.find((entry) => entry.id === draft.studyMood) ?? STUDY_MOODS[0];
  const notificationsOn = NOTIFICATION_KEYS.filter((key) => draft[key]).length;
  const NavNext = ar ? ArrowLeft : ArrowRight;
  const NavBack = ar ? ArrowRight : ArrowLeft;

  return (
    /* `method="post"` is hardening, not routing: a submit before hydration would otherwise
       default to GET and write the password into the URL and the browser history. */
    <form onSubmit={submit} method="post" className="auth-form">
      <div className="wizard-container">
        {/* The circles are decorative; the labels carry the meaning, so `aria-current` goes on
            the label rather than on the numbered bubble a screen reader would read as "2". */}
        <div className="wizard-steps">
          {t.steps.map((label, index) => {
            const number = index + 1;
            const Icon = STEP_ICONS[index];
            return (
              <Fragment key={label}>
                {/* Direct child of the flex row on purpose -- `flex-grow: 1` only fills the
                    gap between two bubbles if it is not nested inside one of them. */}
                {number > 1 && <span className="wizard-step-line" aria-hidden="true" />}
                <div className="auth-wizard-steps">
                  <span
                    className={`wizard-step ${
                      number === step ? "active" : number < step ? "done" : ""
                    }`}
                    aria-hidden="true"
                  >
                    {number < step ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </span>
                  <span
                    className={`auth-wizard-steplabel ${number === step ? "active" : ""}`}
                    aria-current={number === step ? "step" : undefined}
                  >
                    {label}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
        {/* The step content swaps without a navigation, so nothing would otherwise tell a
            screen-reader user that the page moved on. */}
        <p className="sr-only" aria-live="polite">
          {t.stepAria(step, t.steps.length)}
        </p>

        {step === 1 && (
          <div className="wizard-step-content">
            <div className="auth-wizard-section">
              <h3>{t.accountTitle}</h3>
              <p>{t.accountLede}</p>
            </div>
            <Field
              name="name"
              label={t.name}
              autoComplete="name"
              maxLength={100}
              value={draft.name}
              onChange={(value) => set("name", value)}
              error={errorFor("name")}
            />
            <Field
              name="collegeId"
              label={t.collegeId}
              autoComplete="username"
              placeholder={t.collegeIdPlaceholder}
              maxLength={32}
              hint={t.collegeIdHint}
              value={draft.collegeId}
              onChange={(value) => set("collegeId", value)}
              error={errorFor("collegeId")}
            />
            <SelectField
              name="academicYear"
              label={t.year}
              value={draft.academicYear}
              onChange={(value) => set("academicYear", value)}
            >
              {academicYearOptions(ar)}
            </SelectField>
            <Field
              name="email"
              label={t.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              required={false}
              hint={t.emailHint}
              value={draft.email}
              onChange={(value) => set("email", value)}
              error={errorFor("email")}
            />
            <PasswordField
              name="password"
              label={t.password}
              autoComplete="new-password"
              minLength={8}
              hint={t.passwordHint}
              revealLabel={t.show}
              hideLabel={t.hide}
              value={draft.password}
              onChange={(value) => set("password", value)}
              error={errorFor("password")}
            />
            <PasswordStrength password={draft.password} labels={[...t.strength]} />
            <PasswordField
              name="confirmPassword"
              label={t.confirm}
              autoComplete="new-password"
              minLength={8}
              revealLabel={t.show}
              hideLabel={t.hide}
              value={draft.confirm}
              onChange={(value) => set("confirm", value)}
              error={errorFor("confirm")}
            />
            <div className="wizard-step-actions">
              <button type="button" className="primary-button" onClick={() => goTo(2)}>
                {t.next}
                <NavNext className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-step-content">
            <div className="auth-wizard-section">
              <h3>
                <Palette className="w-4 h-4" aria-hidden="true" /> {t.themeTitle}
              </h3>
              <p>{t.themeLede}</p>
              <div className="study-mood-card-grid" role="radiogroup" aria-label={t.themeTitle}>
                {STUDY_MOODS.map((entry) => {
                  const Icon = entry.icon;
                  const active = draft.studyMood === entry.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => previewMood(entry.id)}
                      className={`study-mood-card ${active ? "active" : ""}`}
                    >
                      <span className="study-mood-card-icon" style={{ color: entry.colorToken }}>
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <span className="study-mood-card-label">
                        {ar ? entry.labelAr : entry.labelEn}
                      </span>
                      {active && <Check className="study-mood-card-check" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <SelectField
              name="locale"
              label={t.langTitle}
              hint={t.langHint}
              value={draft.locale}
              onChange={(value) => set("locale", value === "AR" ? "AR" : "EN")}
            >
              <option value="EN">English</option>
              <option value="AR">العربية</option>
            </SelectField>

            <div className="auth-wizard-section">
              <h3>
                <Timer className="w-4 h-4" aria-hidden="true" /> {t.rhythmTitle}
              </h3>
              <p>{t.rhythmLede}</p>
              <div className="auth-preset-row">
                {RHYTHM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="auth-preset-btn"
                    aria-pressed={activePreset?.id === preset.id}
                    onClick={() => applyPreset(preset)}
                  >
                    {t.presets[preset.id]}
                    <small>
                      {preset.focus} / {preset.shortBreak} / {preset.longBreak}
                    </small>
                  </button>
                ))}
              </div>
              <div className="auth-stepper-grid">
                <Stepper
                  label={t.focusLabel}
                  value={draft.focus}
                  min={FOCUS_MINUTES.min}
                  max={FOCUS_MINUTES.max}
                  step={FOCUS_MINUTES.step}
                  unit={t.minutes}
                  decreaseLabel={t.less}
                  increaseLabel={t.more}
                  onChange={(value) => set("focus", value)}
                />
                <Stepper
                  label={t.shortLabel}
                  value={draft.shortBreak}
                  min={SHORT_BREAK_MINUTES.min}
                  max={SHORT_BREAK_MINUTES.max}
                  step={SHORT_BREAK_MINUTES.step}
                  unit={t.minutes}
                  decreaseLabel={t.less}
                  increaseLabel={t.more}
                  onChange={(value) =>
                    /* The server refuses a long break shorter than the short one, so pull the
                       long break up with it instead of letting step 3 fail. */
                    setDraft((current) => ({
                      ...current,
                      shortBreak: value,
                      longBreak: Math.max(current.longBreak, value),
                    }))
                  }
                />
                <Stepper
                  label={t.longLabel}
                  value={draft.longBreak}
                  min={Math.max(LONG_BREAK_MINUTES.min, draft.shortBreak)}
                  max={LONG_BREAK_MINUTES.max}
                  step={LONG_BREAK_MINUTES.step}
                  unit={t.minutes}
                  decreaseLabel={t.less}
                  increaseLabel={t.more}
                  onChange={(value) => set("longBreak", value)}
                />
              </div>
            </div>

            <div className="auth-wizard-section">
              <h3>
                <Bell className="w-4 h-4" aria-hidden="true" /> {t.notifTitle}
              </h3>
              <p>{t.notifLede}</p>
              <div className="auth-toggle-list">
                <ToggleRow
                  icon={<Mail />}
                  checked={draft.emailNotifications}
                  onChange={(value) => set("emailNotifications", value)}
                  title={t.notif.email[0]}
                  note={t.notif.email[1]}
                />
                <ToggleRow
                  icon={<Bell />}
                  checked={draft.inAppNotifications}
                  onChange={(value) => set("inAppNotifications", value)}
                  title={t.notif.inApp[0]}
                  note={t.notif.inApp[1]}
                />
                <ToggleRow
                  icon={<Users />}
                  checked={draft.accountabilityNotifications}
                  onChange={(value) => set("accountabilityNotifications", value)}
                  title={t.notif.accountability[0]}
                  note={t.notif.accountability[1]}
                />
                <ToggleRow
                  icon={<Trophy />}
                  checked={draft.challengeNotifications}
                  onChange={(value) => set("challengeNotifications", value)}
                  title={t.notif.challenge[0]}
                  note={t.notif.challenge[1]}
                />
                <ToggleRow
                  icon={<Sparkles />}
                  checked={draft.aiInsightNotifications}
                  onChange={(value) => set("aiInsightNotifications", value)}
                  title={t.notif.ai[0]}
                  note={t.notif.ai[1]}
                />
                <ToggleRow
                  icon={<Eye />}
                  checked={draft.shareFullNameOnCards}
                  onChange={(value) => set("shareFullNameOnCards", value)}
                  title={t.notif.shareName[0]}
                  note={t.notif.shareName[1]}
                />
              </div>
            </div>

            <div className="wizard-step-actions">
              <button type="button" className="secondary-button" onClick={() => goTo(1)}>
                <NavBack className="w-4 h-4" aria-hidden="true" />
                {t.back}
              </button>
              <button type="button" className="primary-button" onClick={() => goTo(3)}>
                {t.next}
                <NavNext className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-step-content">
            <div className="auth-wizard-section">
              <h3>
                <ShieldCheck className="w-4 h-4" aria-hidden="true" /> {t.reviewTitle}
              </h3>
              <p>{t.reviewLede}</p>
            </div>
            <dl className="auth-review-list">
              <div className="auth-review-row">
                <dt>{t.review.name}</dt>
                <dd>{draft.name.trim()}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.collegeId}</dt>
                {/* Upper-cased because that is what the API stores. */}
                <dd>{draft.collegeId.trim().toUpperCase()}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.year}</dt>
                <dd>{academicYearLabel(Number(draft.academicYear), ar)}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.email}</dt>
                <dd>{draft.email.trim() || t.notSet}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.mood}</dt>
                <dd>{ar ? mood.labelAr : mood.labelEn}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.language}</dt>
                <dd>{draft.locale === "AR" ? "العربية" : "English"}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.rhythm}</dt>
                <dd>{t.rhythmValue(draft.focus, draft.shortBreak, draft.longBreak)}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.notifications}</dt>
                <dd>{t.notifValue(notificationsOn, NOTIFICATION_KEYS.length)}</dd>
              </div>
              <div className="auth-review-row">
                <dt>{t.review.leaderboard}</dt>
                <dd>{draft.shareFullNameOnCards ? t.fullName : t.firstNameOnly}</dd>
              </div>
            </dl>
            <p className="fine-print">{t.finePrint}</p>
            {error && (
              <p className="auth-notice danger" role="alert">
                <TriangleAlert aria-hidden="true" />
                {error}
              </p>
            )}
            <div className="wizard-step-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => goTo(2)}
                disabled={pending}
              >
                <NavBack className="w-4 h-4" aria-hidden="true" />
                {t.back}
              </button>
              <button type="submit" className="primary-button" disabled={pending}>
                {pending ? t.creating : t.create}
              </button>
            </div>
          </div>
        )}

        {/* Errors raised on step 3 but belonging to step 1 (a taken college ID) follow the
            user back, so the message is not left behind on a step they can no longer see. */}
        {error && step !== 3 && (
          <p className="auth-notice danger" role="alert">
            <TriangleAlert aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
