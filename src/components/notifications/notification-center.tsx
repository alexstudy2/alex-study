"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Users,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

function preferenceLabel(key: string, ar: boolean) {
  switch (key) {
    case "emailNotifications":
      return ar ? "البريد الإلكتروني" : "Email notifications";
    case "inAppNotifications":
      return ar ? "داخل التطبيق" : "In-app notifications";
    case "accountabilityNotifications":
      return ar ? "تنبيهات المساءلة والشريك" : "Accountability partner updates";
    case "challengeNotifications":
      return ar ? "تحديثات التحديات" : "Challenge notifications";
    case "aiInsightNotifications":
      return ar ? "رؤى وملاحظات الذكاء الاصطناعي" : "AI insight notifications";
    default:
      return key;
  }
}

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
  const ar = locale === "ar";
  const [items, setItems] = useState(initialItems);
  const [prefs, setPrefs] = useState(preferences);

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

  const NavArrow = ar ? ArrowLeft : ArrowRight;

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        eyebrow={ar ? "مركز التحديثات" : "Update center"}
        title={ar ? "الإشعارات" : "Notifications"}
        description={
          ar
            ? "طلبات الأصدقاء ودعوات المساءلة وتحديثات التحديات في مكان واحد."
            : "Friend requests, accountability invites, and challenge updates in one place."
        }
        actions={
          <Button
            href="/friends"
            variant="secondary"
            size="sm"
            leftIcon={<Users className="w-4 h-4" />}
          >
            {ar ? "الأصدقاء" : "Friends"}
          </Button>
        }
      />

      <section className="social-panel notification-preferences">
        <h2>{ar ? "تفضيلات التنبيهات" : "Notification preferences"}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {Object.entries(prefs).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={() => toggle(key as keyof typeof prefs)}
              />
              <span>{preferenceLabel(key, ar)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="social-panel mt-6">
        <div className="panel-heading">
          <h2>{ar ? "الأحدث" : "Latest"}</h2>
          {items.some((x) => !x.readAt) && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<CheckCheck className="w-4 h-4" />}
              onClick={async () => {
                await fetch("/api/notifications/read-all", { method: "POST" });
                setItems(items.map((x) => ({ ...x, readAt: new Date().toISOString() })));
              }}
            >
              {ar ? "تحديد الكل كمقروء" : "Mark all read"}
            </Button>
          )}
        </div>

        <div className="notification-list mt-4">
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
                  {!item.readAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => mark(item.id)}
                    >
                      {ar ? "تمت القراءة" : "Mark read"}
                    </Button>
                  )}
                  {item.actionUrl && (
                    <Link href={item.actionUrl} className="primary-button">
                      <span>{ar ? "فتح" : "Open"}</span>
                      <NavArrow className="w-3.5 h-3.5 inline-block" />
                    </Link>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              icon={<Bell className="w-6 h-6 text-muted" />}
              title={ar ? "لا توجد إشعارات حاليًا" : "No notifications right now"}
              description={
                ar
                  ? "ستظهر هنا تنبيهات الجلسات والتحديات وطلبات الصداقة فور وصولها."
                  : "Session reminders, challenges, and requests will show up here."
              }
            />
          )}
        </div>
      </section>
    </PageShell>
  );
}
