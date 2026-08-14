"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
    theme: "SYSTEM" | "LIGHT" | "DARK";
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
  theme: "SYSTEM",
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

function applyTheme(theme: "SYSTEM" | "LIGHT" | "DARK") {
  if (theme === "SYSTEM") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme.toLowerCase();
}

export function SettingsWorkspace({ initial, locale }: { initial: Initial; locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const { update } = useSession();
  const [profile, setProfile] = useState(initial);
  const [preference, setPreference] = useState(initial.preference ?? fallbackPreference);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const text = {
    title: ar ? "إعدادات الحساب" : "Account settings",
    intro: ar
      ? "تحكم في حسابك، إيقاع المؤقت، الخصوصية، والإشعارات من مكان واحد."
      : "Control your account, study rhythm, privacy, and notifications in one place.",
    account: ar ? "الحساب" : "Account",
    profile: ar ? "الملف الشخصي" : "Profile",
    name: ar ? "الاسم الكامل" : "Full name",
    year: ar ? "السنة الدراسية" : "Academic year",
    email: ar ? "البريد الاحتياطي" : "Recovery email",
    collegeId: ar ? "الرقم الجامعي" : "College ID",
    preferences: ar ? "التفضيلات" : "Preferences",
    language: ar ? "اللغة" : "Language",
    theme: ar ? "المظهر" : "Theme",
    system: ar ? "النظام" : "System",
    light: ar ? "فاتح" : "Light",
    dark: ar ? "داكن" : "Dark",
    timer: ar ? "المؤقت" : "Timer",
    focus: ar ? "دقائق التركيز" : "Focus minutes",
    short: ar ? "الاستراحة القصيرة" : "Short break",
    long: ar ? "الاستراحة الطويلة" : "Long break",
    cycles: ar ? "الجولات قبل الاستراحة الطويلة" : "Cycles before long break",
    autoBreak: ar ? "بدء الاستراحات تلقائيا" : "Auto-start breaks",
    autoFocus: ar ? "بدء التركيز تلقائيا" : "Auto-start focus",
    ambient: ar ? "الصوت المحيط" : "Ambient sound",
    volume: ar ? "مستوى الصوت" : "Volume",
    notifications: ar ? "الإشعارات" : "Notifications",
    emailNotifications: ar ? "إشعارات البريد الإلكتروني" : "Email notifications",
    inApp: ar ? "الإشعارات داخل التطبيق" : "In-app notifications",
    accountability: ar ? "تذكيرات المساءلة" : "Accountability reminders",
    challenges: ar ? "تحديثات التحديات" : "Challenge updates",
    insightNotifications: ar ? "تحديثات الرؤى الذكية" : "AI insight updates",
    privacy: ar ? "الخصوصية" : "Privacy",
    visibility: ar ? "ظهور الملف الشخصي" : "Profile visibility",
    collegeOnly: ar ? "طلاب الكلية فقط" : "College students only",
    private: ar ? "خاص" : "Private",
    leaderboard: ar ? "الظهور في لوحة المتصدرين" : "Show me on leaderboards",
    fullName: ar
      ? "إظهار الاسم الكامل في بطاقات التحدي العامة"
      : "Show full name on public challenge cards",
    ai: ar ? "الرؤى الذكية" : "AI insights",
    aiEnabled: ar ? "السماح بالرؤى الذكية الشخصية" : "Allow personal AI insights",
    save: ar ? "حفظ التغييرات" : "Save changes",
    saved: ar ? "تم الحفظ" : "Saved",
    export: ar ? "تنزيل نسخة من بياناتي" : "Download my data",
    danger: ar ? "منطقة حساسة" : "Sensitive actions",
    delete: ar ? "حذف الحساب" : "Delete account",
    deleteCopy: ar
      ? "يحذف هذا كل بيانات الحساب نهائيا. اكتب DELETE وأدخل كلمة المرور للتأكيد."
      : "This permanently deletes your account data. Type DELETE and enter your password to confirm.",
    confirm: ar ? "عبارة التأكيد" : "Confirmation phrase",
    password: ar ? "كلمة المرور" : "Password",
    deleteButton: ar ? "حذف نهائي" : "Permanently delete",
    error: ar ? "تعذر حفظ التغييرات." : "Could not save changes.",
    selectLanguage: ar ? "العربية" : "English",
  };

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      name: values.name,
      academicYear: Number(values.academicYear),
      email: values.email,
      locale: values.locale,
    };
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
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
    document.cookie = `alex-study-locale=${String(payload.locale).toLowerCase()}; path=/; max-age=31536000; samesite=lax`;
    setStatus(text.saved);
    router.refresh();
  }

  async function savePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      theme: String(values.theme) as "SYSTEM" | "LIGHT" | "DARK",
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
    setStatus(text.saved);
    router.refresh();
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
    setStatus(text.saved);
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
    setStatus(text.saved);
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
          : text.error,
      );
      return;
    }
    await signOut({ callbackUrl: "/sign-in?deleted=1" });
  }

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div>
          <p className="eyebrow">Alex Study</p>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
        </div>
        <span className="settings-status" role="status" aria-live="polite">
          {status}
        </span>
      </header>
      <nav className="settings-nav" aria-label={ar ? "أقسام الإعدادات" : "Settings sections"}>
        {[
          ["account", text.account],
          ["preferences", text.preferences],
          ["notifications", text.notifications],
          ["privacy", text.privacy],
          ["danger", text.danger],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <section id="account" className="settings-section">
        <div className="settings-section-heading">
          <p className="eyebrow">01</p>
          <h2>{text.account}</h2>
        </div>
        <form className="settings-form" onSubmit={saveProfile}>
          <label>
            {text.name}
            <input name="name" defaultValue={profile.name} autoComplete="name" required />
          </label>
          <label>
            {text.collegeId}
            <input value={profile.collegeId} readOnly aria-describedby="college-id-note" />
            <small id="college-id-note">
              {ar
                ? "يستخدم لتسجيل الدخول ولا يظهر علنا."
                : "Used for sign-in and never shown publicly."}
            </small>
          </label>
          <label>
            {text.year}
            <select name="academicYear" defaultValue={profile.academicYear}>
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
          <label>
            {text.email}
            <input
              name="email"
              defaultValue={profile.email ?? ""}
              type="email"
              autoComplete="email"
            />
          </label>
          <fieldset>
            <legend>{text.language}</legend>
            <div className="segmented-settings">
              <label>
                <input
                  type="radio"
                  name="locale"
                  value="EN"
                  defaultChecked={profile.preference?.locale !== "AR"}
                />
                <span>English</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="locale"
                  value="AR"
                  defaultChecked={profile.preference?.locale === "AR"}
                />
                <span>العربية</span>
              </label>
            </div>
          </fieldset>
          <button className="primary-button" disabled={busy}>
            {text.save}
          </button>
        </form>
      </section>
      <section id="preferences" className="settings-section">
        <div className="settings-section-heading">
          <p className="eyebrow">02</p>
          <h2>{text.preferences}</h2>
        </div>
        <form className="settings-form" onSubmit={savePreferences}>
          <fieldset>
            <legend>{text.theme}</legend>
            <div className="segmented-settings">
              {(
                [
                  ["SYSTEM", text.system],
                  ["LIGHT", text.light],
                  ["DARK", text.dark],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    defaultChecked={preference.theme === value}
                    onChange={() => {
                      setPreference((current) => ({ ...current, theme: value }));
                      applyTheme(value);
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="settings-grid">
            <label>
              {text.focus}
              <input
                type="number"
                name="defaultFocusMinutes"
                min="5"
                max="120"
                defaultValue={preference.defaultFocusMinutes}
              />
            </label>
            <label>
              {text.short}
              <input
                type="number"
                name="defaultShortBreakMinutes"
                min="1"
                max="30"
                defaultValue={preference.defaultShortBreakMinutes}
              />
            </label>
            <label>
              {text.long}
              <input
                type="number"
                name="defaultLongBreakMinutes"
                min="5"
                max="60"
                defaultValue={preference.defaultLongBreakMinutes}
              />
            </label>
            <label>
              {text.cycles}
              <input
                type="number"
                name="pomodorosBeforeLongBreak"
                min="1"
                max="12"
                defaultValue={preference.pomodorosBeforeLongBreak}
              />
            </label>
          </div>
          <div className="settings-grid">
            <label className="setting-toggle">
              <input
                type="checkbox"
                name="autoStartBreaks"
                defaultChecked={preference.autoStartBreaks}
              />
              <span>{text.autoBreak}</span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                name="autoStartFocus"
                defaultChecked={preference.autoStartFocus}
              />
              <span>{text.autoFocus}</span>
            </label>
            <label>
              {text.ambient}
              <select name="ambientSound" defaultValue={preference.ambientSound ?? "off"}>
                <option value="off">Off</option>
                <option value="rain">Rain</option>
                <option value="brown">Brown noise</option>
              </select>
            </label>
            <label>
              {text.volume}
              <input
                type="range"
                name="ambientVolume"
                min="0"
                max="100"
                defaultValue={preference.ambientVolume}
              />
            </label>
          </div>
          <button className="primary-button" disabled={busy}>
            {text.save}
          </button>
        </form>
      </section>
      <section id="notifications" className="settings-section">
        <div className="settings-section-heading">
          <p className="eyebrow">03</p>
          <h2>{text.notifications}</h2>
        </div>
        <div className="settings-toggle-list">
          {(
            [
              ["emailNotifications", text.emailNotifications],
              ["inAppNotifications", text.inApp],
              ["accountabilityNotifications", text.accountability],
              ["challengeNotifications", text.challenges],
              ["aiInsightNotifications", text.insightNotifications],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={preference[key]}
                onChange={async (event) => {
                  const value = event.target.checked;
                  setPreference((current) => ({ ...current, [key]: value }));
                  await patchJson("/api/me/notifications", { [key]: value });
                }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>
      <section id="privacy" className="settings-section">
        <div className="settings-section-heading">
          <p className="eyebrow">04</p>
          <h2>{text.privacy}</h2>
        </div>
        <div className="settings-form">
          <label>
            {text.visibility}
            <select
              value={profile.profileVisibility}
              onChange={async (event) => {
                const value = event.target.value as Initial["profileVisibility"];
                setProfile((current) => ({ ...current, profileVisibility: value }));
                await patchJson("/api/me/privacy", { profileVisibility: value });
              }}
            >
              <option value="COLLEGE_ONLY">{text.collegeOnly}</option>
              <option value="PRIVATE">{text.private}</option>
            </select>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={profile.leaderboardVisible}
              onChange={async (event) => {
                const value = event.target.checked;
                setProfile((current) => ({ ...current, leaderboardVisible: value }));
                await patchJson("/api/me/privacy", { leaderboardVisible: value });
              }}
            />
            <span>{text.leaderboard}</span>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={preference.shareFullNameOnCards}
              onChange={async (event) => {
                const value = event.target.checked;
                setPreference((current) => ({ ...current, shareFullNameOnCards: value }));
                await patchJson("/api/me/privacy", { shareFullNameOnCards: value });
              }}
            />
            <span>{text.fullName}</span>
          </label>
          <div className="settings-action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void downloadExport()}
              disabled={busy}
            >
              {text.export}
            </button>
          </div>
        </div>
      </section>
      <section id="ai" className="settings-section">
        <div className="settings-section-heading">
          <p className="eyebrow">05</p>
          <h2>{text.ai}</h2>
        </div>
        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={profile.aiNudgesEnabled}
            onChange={async (event) => {
              const value = event.target.checked;
              setProfile((current) => ({ ...current, aiNudgesEnabled: value }));
              await patchJson("/api/me/ai", { enabled: value });
            }}
          />
          <span>{text.aiEnabled}</span>
        </label>
      </section>
      <section id="danger" className="settings-section settings-danger">
        <div className="settings-section-heading">
          <p className="eyebrow">06</p>
          <h2>{text.danger}</h2>
        </div>
        <p>{text.deleteCopy}</p>
        <form className="settings-form" onSubmit={deleteAccount}>
          <label>
            {text.password}
            <input
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              required
            />
          </label>
          <label>
            {text.confirm}
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              required
            />
          </label>
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          <button className="danger-button" disabled={busy || deleteConfirmation !== "DELETE"}>
            {text.deleteButton}
          </button>
        </form>
      </section>
    </main>
  );
}
