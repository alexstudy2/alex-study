"use client";
import { useState } from "react";
type Item = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};
export function NotificationCenter({
  initialItems,
  locale,
  preferences,
}: {
  initialItems: Item[];
  locale: "en" | "ar";
  preferences: {
    emailNotifications: boolean;
    inAppNotifications: boolean;
    accountabilityNotifications: boolean;
    challengeNotifications: boolean;
    aiInsightNotifications: boolean;
  };
}) {
  const ar = locale === "ar",
    [items, setItems] = useState(initialItems),
    [prefs, setPrefs] = useState(preferences);
  async function mark(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems(items.map((x) => (x.id === id ? { ...x, readAt: new Date().toISOString() } : x)));
  }
  async function toggle(key: keyof typeof prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await fetch("/api/me/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
  }
  return (
    <main className="social-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="social-header">
        <div>
          <p className="eyebrow">{ar ? "مركز التحديثات" : "Update center"}</p>
          <h1>{ar ? "الإشعارات" : "Notifications"}</h1>
          <p>
            {ar
              ? "طلبات الأصدقاء ودعوات المساءلة وتحديثات التحديات في مكان واحد."
              : "Friend requests, accountability invites, and challenge updates in one place."}
          </p>
        </div>
        <a className="secondary-button" href="/friends">
          {ar ? "الأصدقاء" : "Friends"}
        </a>
      </header>
      <section className="social-panel notification-preferences">
        <h2>{ar ? "التفضيلات" : "Preferences"}</h2>
        {Object.entries(prefs).map(([key, value]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={value}
              onChange={() => toggle(key as keyof typeof prefs)}
            />
            <span>{preferenceLabel(key as keyof typeof prefs, ar)}</span>
          </label>
        ))}
      </section>
      <section className="social-panel">
        <div className="panel-heading">
          <h2>{ar ? "الأحدث" : "Latest"}</h2>
          <button
            className="text-button"
            onClick={async () => {
              await fetch("/api/notifications/read-all", { method: "POST" });
              setItems(items.map((x) => ({ ...x, readAt: new Date().toISOString() })));
            }}
          >
            {ar ? "تحديد الكل كمقروء" : "Mark all read"}
          </button>
        </div>
        <div className="notification-list">
          {items.length ? (
            items.map((item) => (
              <article key={item.id} className={item.readAt ? "" : "unread"}>
                <div>
                  <span className="notification-dot" aria-hidden="true" />
                  <p className="eyebrow">{item.type.replaceAll("_", " ")}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <time>
                    {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "Africa/Cairo",
                    }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <div className="inline-actions">
                  {item.actionUrl && (
                    <a className="secondary-button" href={item.actionUrl}>
                      {ar ? "فتح" : "Open"}
                    </a>
                  )}
                  {!item.readAt && (
                    <button className="text-button" onClick={() => mark(item.id)}>
                      {ar ? "تمت القراءة" : "Mark read"}
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="muted-copy">{ar ? "لا توجد إشعارات بعد." : "No notifications yet."}</p>
          )}
        </div>
      </section>
    </main>
  );
}

function preferenceLabel(
  key:
    | "emailNotifications"
    | "inAppNotifications"
    | "accountabilityNotifications"
    | "challengeNotifications"
    | "aiInsightNotifications",
  ar: boolean,
) {
  const english = {
    emailNotifications: "Email notifications",
    inAppNotifications: "In-app notifications",
    accountabilityNotifications: "Accountability reminders",
    challengeNotifications: "Challenge updates",
    aiInsightNotifications: "AI insight updates",
  };
  const arabic = {
    emailNotifications: "إشعارات البريد الإلكتروني",
    inAppNotifications: "الإشعارات داخل التطبيق",
    accountabilityNotifications: "تذكيرات المساءلة",
    challengeNotifications: "تحديثات التحديات",
    aiInsightNotifications: "تحديثات الرؤى الذكية",
  };
  return (ar ? arabic : english)[key];
}
