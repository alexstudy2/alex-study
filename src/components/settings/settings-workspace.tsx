"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  User,
  Sliders,
  Bell,
  Shield,
  AlertTriangle,
  LogOut,
  Download,
  Check,
  Sparkles,
  Lock,
  Gem,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { STUDY_MOODS } from "@/components/ui/study-background-selector";
import {
  applyMood,
  moodFromEnum,
  saveMood,
  type StudyMood,
  type StudyMoodEnum,
} from "@/lib/settings/study-mood";
import {
  applySkin,
  skinFromEnum,
  saveSkin,
  type StudySkin,
  type StudySkinEnum,
} from "@/lib/settings/study-skin";
import { writeLocaleCookie } from "@/lib/i18n/locale-cookie";

type Locale = "en" | "ar";
type Initial = {
  name: string;
  collegeId: string;
  academicYear: number;
  email: string | null;
  aiNudgesEnabled: boolean;
  leaderboardVisible: boolean;
  profileVisibility: "PRIVATE" | "COLLEGE_ONLY";
  preference: {
    locale: "EN" | "AR";
    studyMood: StudyMoodEnum;
    skin: StudySkinEnum;
    defaultFocusMinutes: number;
    defaultShortBreakMinutes: number;
    defaultLongBreakMinutes: number;
    pomodorosBeforeLongBreak: number;
    autoStartBreaks: boolean;
    autoStartFocus: boolean;
    ambientSound: string | null;
    ambientVolume: number;
    emailNotifications: boolean;
    inAppNotifications: boolean;
    accountabilityNotifications: boolean;
    challengeNotifications: boolean;
    aiInsightNotifications: boolean;
    shareFullNameOnCards: boolean;
  } | null;
};

const fallbackPreference: NonNullable<Initial["preference"]> = {
  locale: "EN",
  studyMood: "NOTEBOOK",
  skin: "ATLAS",
  defaultFocusMinutes: 25,
  defaultShortBreakMinutes: 5,
  defaultLongBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  ambientSound: "off",
  ambientVolume: 35,
  emailNotifications: true,
  inAppNotifications: true,
  accountabilityNotifications: true,
  challengeNotifications: true,
  aiInsightNotifications: true,
  shareFullNameOnCards: false,
};

type TabKey = "profile" | "timer" | "notifications" | "privacy" | "account";

export function SettingsWorkspace({ initial, locale }: { initial: Initial; locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const { update } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [profile, setProfile] = useState(initial);
  const [preference, setPreference] = useState(initial.preference ?? fallbackPreference);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [studyMood, setStudyMood] = useState<StudyMood>(
    moodFromEnum(initial.preference?.studyMood)
  );
  const [skin, setSkin] = useState<StudySkin>(skinFromEnum(initial.preference?.skin));

  function changeStudyMood(mood: StudyMood) {
    const previous = studyMood;
    setStudyMood(mood);
    applyMood(mood);
    setStatus("");
    /* Optimistic: the palette repaints on tap. Undo it if the write fails rather than
       leaving the screen showing a preference the server rejected. */
    void saveMood(mood).then(
      () => {
        flashSaved();
        /* And then make it stick. applyMood only touched the live DOM node; the cached RSC
           payload still carries data-mood from layout.tsx as it was when the page was
           requested, so any later server render -- a navigation, a revalidate, any other
           router.refresh() on the page -- re-emits <html data-mood="old"> and the palette
           silently reverts. Refreshing after the write is what makes "live" also mean
           "stayed". */
        router.refresh();
      },
      () => {
        setStudyMood(previous);
        applyMood(previous);
        setStatus(text.error);
      }
    );
  }

  /* Same shape as changeStudyMood, deliberately. The skin is a much louder change -- it swaps
     every radius, border and shadow in the app at once -- but the interaction contract should
     be identical: it lands instantly, it is refreshed into the server payload, and it rolls
     back if the server refuses. */
  function changeSkin(next: StudySkin) {
    const previous = skin;
    setSkin(next);
    applySkin(next);
    setStatus("");
    void saveSkin(next).then(
      () => {
        flashSaved();
        router.refresh();
      },
      () => {
        setSkin(previous);
        applySkin(previous);
        setStatus(text.error);
      }
    );
  }

  const text = {
    title: ar ? "إعدادات الحساب والدراسة" : "Account & Study Settings",
    intro: ar
      ? "تحكم في حسابك، إيقاع المؤقت، الخصوصية، والإشعارات من مكان واحد."
      : "Manage your profile, study rhythms, privacy, and notifications in one place.",
    save: ar ? "حفظ التغييرات" : "Save Changes",
    saved: ar ? "تم حفظ التغييرات بنجاح!" : "Changes saved successfully!",
    error: ar ? "تعذر حفظ التغييرات." : "Could not save changes.",
    export: ar ? "تنزيل نسخة من بياناتي (JSON)" : "Download My Data (JSON)",
    signOut: ar ? "تسجيل الخروج" : "Sign Out",
    deleteButton: ar ? "حذف الحساب نهائيًا" : "Permanently Delete Account",
  };

  function flashSaved() {
    setStatus(text.saved);
    setTimeout(() => setStatus(""), 3500);
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    /* Only send the re-auth password when provided -- an empty string would fail the
       server schema's min(1), and unchanged emails don't need it. */
    const payload = {
      name: values.name,
      academicYear: Number(values.academicYear),
      email: values.email,
      locale: values.locale,
      ...(values.currentPassword ? { currentPassword: values.currentPassword } : {}),
    };
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      if (response.status === 403) {
        setStatus(
          ar
            ? "كلمة المرور الحالية مطلوبة لتغيير البريد الإلكتروني."
            : "Your current password is required to change the recovery email."
        );
        return;
      }
      setStatus(text.error);
      return;
    }
    const data = await response.json();
    setProfile((current) => ({ ...current, ...data.account }));
    await update({
      name: data.account.name,
      academicYear: data.account.academicYear,
      email: data.account.email,
      locale: payload.locale,
    });
    writeLocaleCookie(String(payload.locale));
    flashSaved();
    router.refresh();
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      defaultFocusMinutes: Number(values.defaultFocusMinutes),
      defaultShortBreakMinutes: Number(values.defaultShortBreakMinutes),
      defaultLongBreakMinutes: Number(values.defaultLongBreakMinutes),
      pomodorosBeforeLongBreak: Number(values.pomodorosBeforeLongBreak),
      autoStartBreaks: values.autoStartBreaks === "on",
      autoStartFocus: values.autoStartFocus === "on",
      ambientSound: String(values.ambientSound),
      ambientVolume: Number(values.ambientVolume),
    };
    const response = await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      setStatus(text.error);
      return;
    }
    setPreference((current) => ({ ...current, ...payload }));
    flashSaved();
    router.refresh();
  }

  async function patchPreferenceField(field: string, value: unknown) {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/me/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setBusy(false);
    if (response.ok) {
      setPreference((current) => ({ ...current, [field]: value }));
      flashSaved();
    } else {
      setStatus(text.error);
    }
  }

  async function patchJson(url: string, payload: Record<string, unknown>) {
    setBusy(true);
    setStatus("");
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      setStatus(text.error);
      return false;
    }
    flashSaved();
    return true;
  }

  async function downloadExport() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/me/export");
    setBusy(false);
    if (!response.ok) {
      setStatus(text.error);
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "alex-study-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    flashSaved();
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setDeleteError("");
    const response = await fetch("/api/me", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
    });
    setBusy(false);
    if (!response.ok) {
      setDeleteError(
        response.status === 403
          ? ar
            ? "كلمة المرور غير صحيحة."
            : "The password is incorrect."
          : text.error
      );
      return;
    }
    /* Relative navigation by hand -- see the note in app-shell.tsx: next-auth's own
       redirect is derived from NEXTAUTH_URL and can point off this origin entirely. */
    await signOut({ redirect: false });
    window.location.assign("/sign-in?deleted=1");
  }

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "profile", label: ar ? "الملف الشخصي" : "Profile", icon: User },
    { key: "timer", label: ar ? "المؤقت والمظهر" : "Timer & Appearance", icon: Sliders },
    { key: "notifications", label: ar ? "الإشعارات" : "Notifications", icon: Bell },
    { key: "privacy", label: ar ? "الخصوصية والذكاء" : "Privacy & AI", icon: Shield },
    { key: "account", label: ar ? "الحساب والخروج" : "Account & Danger", icon: AlertTriangle },
  ];

  return (
    <div className="settings-page-wrapper" dir={ar ? "rtl" : "ltr"}>
      {/* 1. Header Banner */}
      <header className="settings-hero-header">
        <div className="flex flex-col gap-1">
          <span className="eyebrow flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-primary" />
            {ar ? "تفضيلات أليكس ستادي" : "Alex Study Preferences"}
          </span>
          <h1 className="settings-hero-title">{text.title}</h1>
          <p className="settings-hero-subtitle">{text.intro}</p>
        </div>

        {status && (
          <div className="settings-status-badge" role="status" aria-live="polite">
            <Check className="w-4 h-4 text-success" />
            <span>{status}</span>
          </div>
        )}
      </header>

      {/* 2. Doodle Segmented Category Navigation */}
      <nav className="settings-category-tabs" role="tablist" aria-label={ar ? "أقسام الإعدادات" : "Settings tabs"}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`settings-tab-btn ${isActive ? "active" : ""}`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. Tab Contents */}
      <div className="settings-content-body">
        {/* TAB 1: Profile & Language */}
        {activeTab === "profile" && (
          <section className="settings-notebook-card">
            <div className="card-header-line">
              <User className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-extrabold text-foreground m-0">
                  {ar ? "المعلومات الشخصية واللغة" : "Personal Profile & Language"}
                </h2>
                <p className="text-xs text-muted m-0">
                  {ar ? "بيانات حسابك الأكاديمي ولغة الواجهة." : "Your academic identity and display language."}
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="settings-doodle-form mt-4">
              <div className="form-row-grid">
                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "الاسم الكامل" : "Full Name"}</span>
                  <input
                    name="name"
                    defaultValue={profile.name}
                    autoComplete="name"
                    required
                    className="doodle-input"
                  />
                </label>

                <label className="doodle-form-field">
                  <span className="field-label flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-muted" />
                    {ar ? "الرقم الجامعي (ثابت)" : "College ID (Fixed)"}
                  </span>
                  <input
                    value={profile.collegeId}
                    readOnly
                    className="doodle-input bg-surface-sunken opacity-80 cursor-not-allowed"
                  />
                </label>
              </div>

              <div className="form-row-grid">
                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "السنة الدراسية" : "Academic Year"}</span>
                  <select
                    name="academicYear"
                    defaultValue={profile.academicYear}
                    className="doodle-select"
                  >
                    {[1, 2, 3, 4, 5, 6].map((year) => (
                      <option key={year} value={year}>
                        {ar
                          ? year === 6
                            ? "سنة الامتياز (Internship)"
                            : `السنة ${year}`
                          : year === 6
                            ? "Internship (Intern)"
                            : `Year ${year}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "البريد الإلكتروني الاحتياطي" : "Recovery Email"}</span>
                  <input
                    name="email"
                    defaultValue={profile.email ?? ""}
                    type="email"
                    autoComplete="email"
                    placeholder="student@example.com"
                    className="doodle-input"
                  />
                </label>
              </div>

              {/* Changing the recovery email now requires re-entering the password
                  (server-enforced): that address receives password-reset mail, so moving
                  it must cost the same proof as deleting the account. */}
              <label className="doodle-form-field">
                <span className="field-label">
                  {ar
                    ? "كلمة المرور الحالية — مطلوبة فقط عند تغيير البريد"
                    : "Current Password — only needed when changing email"}
                </span>
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="doodle-input"
                />
              </label>

              {/* Language Selection */}
              <div className="doodle-form-field">
                <span className="field-label">{ar ? "لغة التطبيق" : "Application Language"}</span>
                <div className="doodle-language-picker">
                  <label className={`lang-option ${profile.preference?.locale !== "AR" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="locale"
                      value="EN"
                      defaultChecked={profile.preference?.locale !== "AR"}
                      className="sr-only"
                    />
                    <span className="font-bold">English (EN)</span>
                  </label>
                  <label className={`lang-option ${profile.preference?.locale === "AR" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="locale"
                      value="AR"
                      defaultChecked={profile.preference?.locale === "AR"}
                      className="sr-only"
                    />
                    <span className="font-bold">العربية (AR)</span>
                  </label>
                </div>
              </div>

              <div className="form-submit-row">
                <Button variant="primary" size="md" type="submit" isLoading={busy}>
                  {text.save}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 2: Timer & Appearance */}
        {activeTab === "timer" && (
          <section className="settings-notebook-card">
            <div className="card-header-line">
              <Sliders className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-extrabold text-foreground m-0">
                  {ar ? "تفضيلات المؤقت والمظهر" : "Study Timer & Appearance"}
                </h2>
                <p className="text-xs text-muted m-0">
                  {ar ? "اضبط فترات البومودورو وأجواء المذاكرة." : "Customize your study sessions, intervals, and mood."}
                </p>
              </div>
            </div>

            {/* Visual Style (skin) Picker -- the material axis. Sits above the mood picker
                because it is the larger decision: the mood repaints colours, the skin changes
                what every surface is made of. */}
            <div className="mt-4 mb-6">
              <span className="field-label block mb-1">
                {ar ? "النمط البصري" : "Visual Style"}
              </span>
              <p className="text-xs text-muted mt-0 mb-2">
                {ar
                  ? "النمط يحدد الحواف والظلال والخامات. الألوان تظل من اختيارك للجو أدناه."
                  : "The style sets the edges, shadows and materials. Colours still come from your mood choice below."}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                {/* Each preview draws itself with its own skin's material values rather than
                    with var(--radius-doodle) and friends. That is the whole point: those token
                    names resolve to whichever skin is currently active, so a token-driven
                    preview would render both options identically and the picker would be
                    unusable. Atlas can safely use --glass-rim/--elevation-2/--bento-radius
                    because those live in the bare :root and no skin block overrides them;
                    doodle's geometry has to be literal. Colours stay tokenised either way, so
                    both previews follow the active mood. */}
                <button
                  type="button"
                  aria-pressed={skin === "atlas"}
                  onClick={() => changeSkin("atlas")}
                  className={`theme-card-btn ${skin === "atlas" ? "active" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="block w-full h-8 mb-1.5"
                    style={{
                      borderRadius: "calc(var(--bento-radius) * 0.7)",
                      border: "1px solid var(--glass-rim)",
                      boxShadow: "var(--elevation-2)",
                      background: "var(--glass-bg-raised)",
                      backdropFilter: "blur(6px)",
                    }}
                  />
                  <span className="inline-flex items-center gap-1">
                    <Gem className="w-4 h-4" style={{ color: "var(--primary-strong)" }} />
                    <span className="text-xs font-extrabold">{ar ? "أطلس" : "Atlas"}</span>
                  </span>
                  <span className="text-[10px] text-muted truncate max-w-full text-center">
                    {ar ? "زجاج فخم · الافتراضي" : "Premium glass · Default"}
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={skin === "doodle"}
                  onClick={() => changeSkin("doodle")}
                  className={`theme-card-btn ${skin === "doodle" ? "active" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className="block w-full h-8 mb-1.5"
                    style={{
                      borderRadius: "20px 6px 18px 8px/8px 18px 6px 20px",
                      border: "2px solid var(--secondary)",
                      boxShadow: "2px 2px 0px var(--secondary)",
                      background: "var(--surface)",
                    }}
                  />
                  <span className="inline-flex items-center gap-1">
                    <PenTool className="w-4 h-4" style={{ color: "var(--secondary)" }} />
                    <span className="text-xs font-extrabold">{ar ? "دودل" : "Doodle"}</span>
                  </span>
                  <span className="text-[10px] text-muted truncate max-w-full text-center">
                    {ar ? "الكلاسيكي المرسوم" : "Hand-drawn classic"}
                  </span>
                </button>
              </div>
            </div>

            {/* Study Mood Picker -- one choice drives the whole palette and the background */}
            <div className="mt-4 mb-6">
              <span className="field-label block mb-1">
                {ar ? "أجواء المذاكرة" : "Study Mood"}
              </span>
              <p className="text-xs text-muted mt-0 mb-2">
                {ar
                  ? "الجو الواحد يحدد الألوان والخلفية معًا."
                  : "One mood sets both the colour palette and the animated background."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {STUDY_MOODS.map((m) => {
                  const Icon = m.icon;
                  const isCurrent = studyMood === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => changeStudyMood(m.id)}
                      className={`theme-card-btn ${isCurrent ? "active" : ""}`}
                    >
                      <Icon className="w-5 h-5 mb-1" style={{ color: m.colorToken }} />
                      <span className="text-xs font-extrabold">{ar ? m.labelAr : m.labelEn}</span>
                      <span className="text-[10px] text-muted truncate max-w-full text-center">
                        {ar ? m.descAr : m.descEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timer Durations Form */}
            <form onSubmit={savePreferences} className="settings-doodle-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "التركيز (دقيقة)" : "Focus (mins)"}</span>
                  <input
                    type="number"
                    name="defaultFocusMinutes"
                    min="5"
                    max="120"
                    defaultValue={preference.defaultFocusMinutes}
                    className="doodle-input font-mono font-bold"
                  />
                </label>

                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "راحة قصيرة (دقيقة)" : "Short Break"}</span>
                  <input
                    type="number"
                    name="defaultShortBreakMinutes"
                    min="1"
                    max="30"
                    defaultValue={preference.defaultShortBreakMinutes}
                    className="doodle-input font-mono font-bold"
                  />
                </label>

                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "راحة طويلة (دقيقة)" : "Long Break"}</span>
                  <input
                    type="number"
                    name="defaultLongBreakMinutes"
                    min="5"
                    max="60"
                    defaultValue={preference.defaultLongBreakMinutes}
                    className="doodle-input font-mono font-bold"
                  />
                </label>

                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "الجولات قبل الطويلة" : "Cycles"}</span>
                  <input
                    type="number"
                    name="pomodorosBeforeLongBreak"
                    min="1"
                    max="10"
                    defaultValue={preference.pomodorosBeforeLongBreak}
                    className="doodle-input font-mono font-bold"
                  />
                </label>
              </div>

              {/* Ambient Sound Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "الصوت المحيط الافتراضي" : "Ambient Sound"}</span>
                  <select
                    name="ambientSound"
                    defaultValue={preference.ambientSound ?? "off"}
                    className="doodle-select"
                  >
                    <option value="off">{ar ? "بدون صوت محيط" : "Off (Silent)"}</option>
                    <option value="rain">{ar ? "صوت المطر الهادئ" : "Rain"}</option>
                    <option value="whitenoise">{ar ? "الضوضاء البيضاء" : "White Noise"}</option>
                    <option value="waves">{ar ? "أمواج البحر" : "Ocean Waves"}</option>
                    <option value="cafe">{ar ? "أجواء المقهى" : "Cafe Ambience"}</option>
                  </select>
                </label>

                <label className="doodle-form-field">
                  <span className="field-label">{ar ? "مستوى الصوت (0 - 100)" : "Volume"}</span>
                  <input
                    type="number"
                    name="ambientVolume"
                    min="0"
                    max="100"
                    defaultValue={preference.ambientVolume}
                    className="doodle-input font-mono font-bold"
                  />
                </label>
              </div>

              {/* Auto start switches */}
              <div className="flex flex-col gap-3 mt-4 pt-3 border-t-2 border-dashed border-line">
                <label className="doodle-switch-label">
                  <input
                    type="checkbox"
                    name="autoStartBreaks"
                    defaultChecked={preference.autoStartBreaks}
                    className="doodle-switch-input"
                  />
                  <div>
                    <strong className="text-xs block text-foreground">
                      {ar ? "بدء الاستراحات تلقائيًا" : "Auto-start breaks"}
                    </strong>
                    <span className="text-[11px] text-muted">
                      {ar ? "يبدأ عداد الراحة بمجرد انتهاء جلسة التركيز." : "Timer moves to break without manual click."}
                    </span>
                  </div>
                </label>

                <label className="doodle-switch-label">
                  <input
                    type="checkbox"
                    name="autoStartFocus"
                    defaultChecked={preference.autoStartFocus}
                    className="doodle-switch-input"
                  />
                  <div>
                    <strong className="text-xs block text-foreground">
                      {ar ? "بدء جلسة التركيز التالية تلقائيًا" : "Auto-start next focus session"}
                    </strong>
                    <span className="text-[11px] text-muted">
                      {ar ? "يبدأ التركيز التالي فور انتهاء فترة الراحة." : "Continue study rhythm seamlessly."}
                    </span>
                  </div>
                </label>
              </div>

              <div className="form-submit-row">
                <Button variant="primary" size="md" type="submit" isLoading={busy}>
                  {text.save}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 3: Notifications */}
        {activeTab === "notifications" && (
          <section className="settings-notebook-card">
            <div className="card-header-line">
              <Bell className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-extrabold text-foreground m-0">
                  {ar ? "إشعارات التطبيق والبريد" : "Notification Preferences"}
                </h2>
                <p className="text-xs text-muted m-0">
                  {ar ? "حدد ما يصلك من تذكيرات وتحديثات دورية." : "Control reminders, alerts, and summaries."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-4">
              {[
                {
                  field: "emailNotifications",
                  title: ar ? "إشعارات البريد الإلكتروني" : "Email Notifications",
                  desc: ar ? "ملخص أسبوعي وتنبيهات المهام الحرجة." : "Weekly recap and critical deadlines via email.",
                  checked: preference.emailNotifications,
                },
                {
                  field: "inAppNotifications",
                  title: ar ? "الإشعارات داخل الموقع" : "In-App Notifications",
                  desc: ar ? "تنبيهات في شريط الإشعارات أثناء التصفح." : "Live banners and badge updates while on Alex Study.",
                  checked: preference.inAppNotifications,
                },
                {
                  field: "accountabilityNotifications",
                  title: ar ? "تذكيرات المساءلة والالتزام" : "Accountability Check-ins",
                  desc: ar ? "رسائل تشجيعية عند انقطاعك عن المذاكرة." : "Friendly nudges when your streak is about to pause.",
                  checked: preference.accountabilityNotifications,
                },
                {
                  field: "challengeNotifications",
                  title: ar ? "تحديثات التحديات الطلابية" : "Challenge Updates",
                  desc: ar ? "تنبيهات عند انضمام زميل أو انتهاء تحدٍ." : "Alerts when peers join or challenges conclude.",
                  checked: preference.challengeNotifications,
                },
                {
                  field: "aiInsightNotifications",
                  title: ar ? "تحديثات الرؤى الذكية اليومية" : "AI Insight Notes",
                  desc: ar ? "إشعار عند توفر تحليل جديد لعاداتك الدراسية." : "Notify when a new study rhythm analysis is ready.",
                  checked: preference.aiInsightNotifications,
                },
              ].map((item) => (
                <label key={item.field} className="doodle-switch-label p-3 rounded-lg border border-secondary bg-surface-sunken">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      const val = e.target.checked;
                      void patchPreferenceField(item.field, val);
                    }}
                    className="doodle-switch-input"
                  />
                  <div>
                    <strong className="text-sm block text-foreground">{item.title}</strong>
                    <span className="text-xs text-muted">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* TAB 4: Privacy & AI */}
        {activeTab === "privacy" && (
          <section className="settings-notebook-card">
            <div className="card-header-line">
              <Shield className="w-5 h-5 text-primary" />
              <div>
                <h2 className="text-base font-extrabold text-foreground m-0">
                  {ar ? "الخصوصية والذكاء الاصطناعي" : "Privacy & AI Insights"}
                </h2>
                <p className="text-xs text-muted m-0">
                  {ar ? "تحكم في مستوى ظهور ملفك وتخصيص نصائح الذكاء الاصطناعي." : "Manage your public presence and AI study companion."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-4">
              {/* AI Nudges Toggle */}
              <label className="doodle-switch-label p-3 rounded-lg border border-secondary bg-surface-sunken">
                <input
                  type="checkbox"
                  checked={profile.aiNudgesEnabled}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setProfile((c) => ({ ...c, aiNudgesEnabled: val }));
                    await patchJson("/api/me/ai", { enabled: val });
                  }}
                  className="doodle-switch-input"
                />
                <div>
                  <strong className="text-sm block text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    {ar ? "تفعيل الرؤى والنصائح الذكية الشخصية" : "Enable Personal AI Study Insights"}
                  </strong>
                  <span className="text-xs text-muted">
                    {ar
                      ? "يسمح للنظام بتحليل جلساتك لتقديم اقتراحات مخصصة لإدارة الضغط والوقت."
                      : "Analyzes focus logs to suggest optimal study hours and rest intervals."}
                  </span>
                </div>
              </label>

              {/* Leaderboard Visible */}
              <label className="doodle-switch-label p-3 rounded-lg border border-secondary bg-surface-sunken">
                <input
                  type="checkbox"
                  checked={profile.leaderboardVisible}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setProfile((c) => ({ ...c, leaderboardVisible: val }));
                    await patchJson("/api/me", { leaderboardVisible: val });
                  }}
                  className="doodle-switch-input"
                />
                <div>
                  <strong className="text-sm block text-foreground">
                    {ar ? "الظهور في لوحة المتصدرين العامة" : "Show on Public Leaderboards"}
                  </strong>
                  <span className="text-xs text-muted">
                    {ar
                      ? "إظهار اسمك وساعات دراستك لطلاب الكلية لتحفيز المنافسة الشريفة."
                      : "Allow peers to see your focus minutes on academic rankings."}
                  </span>
                </div>
              </label>

              {/* Data Export Box */}
              <div className="p-4 rounded-xl border-2 border-dashed border-secondary bg-surface mt-2 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <strong className="text-sm block text-foreground">
                    {ar ? "نسخة من بياناتك الدراسية" : "Download Your Study Data"}
                  </strong>
                  <span className="text-xs text-muted">
                    {ar ? "تنزيل ملف JSON كامل يحوي كل مهامك وجلساتك وإحصائياتك." : "Export complete JSON of tasks, sessions, and logs."}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => void downloadExport()}
                  disabled={busy}
                >
                  {text.export}
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* TAB 5: Account & Danger */}
        {activeTab === "account" && (
          <div className="flex flex-col gap-6">
            {/* Sign Out Card */}
            <section className="settings-notebook-card">
              <div className="card-header-line">
                <LogOut className="w-5 h-5 text-secondary" />
                <div>
                  <h2 className="text-base font-extrabold text-foreground m-0">
                    {ar ? "تسجيل الخروج من الجلسة" : "Session Sign Out"}
                  </h2>
                  <p className="text-xs text-muted m-0">
                    {ar ? "إنهاء الجلسة الحالية على هذا الجهاز والعودة لصفحة الدخول." : "Log out from your current device session."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                <span className="text-xs text-muted font-bold">
                  {ar ? "هل ترغب في تسجيل الخروج الآن؟" : "Ready to log out of your session?"}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<LogOut className="w-4 h-4 text-danger" />}
                  onClick={() => {
                    void signOut({ redirect: false }).then(() =>
                      window.location.assign("/sign-in")
                    );
                  }}
                >
                  {text.signOut}
                </Button>
              </div>
            </section>

            {/* Danger Zone: Delete Account */}
            <section className="settings-notebook-card danger-zone-card">
              <div className="card-header-line">
                <AlertTriangle className="w-5 h-5 text-danger" />
                <div>
                  <h2 className="text-base font-extrabold text-danger m-0">
                    {ar ? "منطقة حساسة: حذف الحساب نهائيًا" : "Danger Zone: Permanent Account Deletion"}
                  </h2>
                  <p className="text-xs text-muted m-0">
                    {ar
                      ? "هذا الإجراء نهائي ولا يمكن الرجوع عنه. سيتم مسح كافة المهام والجلسات والإحصائيات."
                      : "This action is irreversible and permanently wipes all your tasks, logs, and progress."}
                  </p>
                </div>
              </div>

              <form onSubmit={deleteAccount} className="settings-doodle-form mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="doodle-form-field">
                    <span className="field-label">{ar ? "كلمة المرور الحالية" : "Current Password"}</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="doodle-input"
                    />
                  </label>

                  <label className="doodle-form-field">
                    <span className="field-label">
                      {ar ? "اكتب DELETE للتأكيد" : "Type DELETE to confirm"}
                    </span>
                    <input
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      required
                      placeholder="DELETE"
                      className="doodle-input font-mono font-bold"
                    />
                  </label>
                </div>

                {deleteError && (
                  <p className="text-xs font-bold text-danger mt-2" role="alert">
                    {deleteError}
                  </p>
                )}

                <div className="form-submit-row mt-3">
                  <Button
                    variant="danger"
                    size="sm"
                    type="submit"
                    disabled={busy || deleteConfirmation !== "DELETE"}
                  >
                    {text.deleteButton}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
