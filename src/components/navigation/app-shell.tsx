"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AlexStudyLogo } from "@/components/ui/logo";
import { StudyBackgroundSelector } from "@/components/ui/study-background-selector";
import type { StudyMood } from "@/lib/settings/study-mood";
import { Bell, LogOut, MoreHorizontal, Settings, X } from "lucide-react";
import { useRef, useState } from "react";
import { MobileMoreSheet } from "./mobile-more-sheet";
import {
  isActive,
  mobilePrimaryItems,
  navigationGroups,
  type NavigationItem,
} from "./navigation-items";

type ShellUser = { name: string; locale: "EN" | "AR" };

const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/manual-reset",
  "/reset-password",
  "/share",
  "/onboarding",
];

export function AppShell({
  children,
  user,
  unreadCount,
  initialMood,
}: {
  children: React.ReactNode;
  user: ShellUser | null;
  unreadCount: number;
  initialMood: StudyMood;
}) {
  const pathname = usePathname();
  const { data: clientSession } = useSession();
  const effectiveUser =
    user ??
    (clientSession?.user
      ? {
          name: clientSession.user.name ?? "Student",
          locale: ((clientSession.user as unknown as Record<string, unknown>).locale as "EN" | "AR") ?? "AR",
        }
      : null);

  /* The route the sheet was opened on, rather than a boolean. Navigating (including a
     browser back/forward gesture) therefore closes it during render — no effect needed. */
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreOpen = moreOpenPath === pathname;

  function closeMore() {
    setMoreOpenPath(null);
    moreButtonRef.current?.focus();
  }

  if (!effectiveUser || pathname === "/" || publicPaths.some((path) => pathname.startsWith(path)))
    return children;

  const ar = effectiveUser.locale === "AR";

  async function handleSignOut() {
    /* Don't leave the previous account's mood behind for whoever signs in next on this
       device. The palette itself comes from the server, so this is only hygiene. */
    try {
      localStorage.removeItem("alex-study-bg-mood");
    } catch {}
    await signOut({ callbackUrl: "/sign-in" });
  }

  return (
    <div className="app-frame" dir={ar ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">
        {ar ? "تخطي إلى المحتوى" : "Skip to content"}
      </a>
      <aside className="app-sidebar">
        <Link className="app-wordmark" href="/dashboard" aria-label="Alex Study">
          <AlexStudyLogo size={34} />
        </Link>
        <nav aria-label={ar ? "التنقل الرئيسي" : "Primary navigation"} className="sidebar-nav">
          {navigationGroups.map((group, groupIdx) => (
            <div key={group.title} className="sidebar-group">
              <span className="sidebar-group-title">
                {ar ? group.titleAr : group.title}
              </span>
              {group.items.map((item) => (
                <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} />
              ))}
              {groupIdx < navigationGroups.length - 1 && <div className="sidebar-rule" />}
            </div>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <ShellLink
            item={{
              href: "/notifications",
              label: "Notifications",
              labelAr: "الإشعارات",
              icon: Bell,
            }}
            pathname={pathname}
            ar={ar}
            badge={unreadCount}
          />
          <ShellLink
            item={{ href: "/settings", label: "Settings", labelAr: "الإعدادات", icon: Settings }}
            pathname={pathname}
            ar={ar}
          />
          {/* Desktop Study Background Mood Switcher */}
          <div className="pt-2 pb-1 border-t border-dashed border-line">
            <span className="sidebar-group-title block mb-1">
              {ar ? "أجواء المذاكرة" : "Study Mood"}
            </span>
            <StudyBackgroundSelector
              locale={ar ? "ar" : "en"}
              variant="sidebar"
              initialMood={initialMood}
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSignOut()}
            title={ar ? "تسجيل الخروج" : "Sign out"}
            className="flex items-center justify-center gap-2 p-1.5 mt-1 rounded-md border border-line bg-surface hover:bg-danger-subtle hover:text-danger text-xs font-bold text-muted transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>{ar ? "تسجيل الخروج" : "Sign out"}</span>
          </button>
          <div className="shell-profile">
            <span aria-hidden="true">{effectiveUser.name.trim().slice(0, 1).toUpperCase()}</span>
            <strong className="truncate">{effectiveUser.name}</strong>
          </div>
        </div>
      </aside>
      <div id="main-content" className="app-content" tabIndex={-1}>
        {children}
      </div>
      <nav className="mobile-navigation" aria-label={ar ? "التنقل الرئيسي" : "Primary navigation"}>
        {mobilePrimaryItems.map((item) => (
          <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} compact />
        ))}
        <button
          ref={moreButtonRef}
          type="button"
          className="mobile-more-trigger"
          aria-expanded={moreOpen}
          aria-label={ar ? "المزيد" : "More"}
          onClick={() => (moreOpen ? closeMore() : setMoreOpenPath(pathname))}
        >
          {moreOpen ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
          <span>{ar ? "المزيد" : "More"}</span>
        </button>
      </nav>
      <MobileMoreSheet
        open={moreOpen}
        onClose={closeMore}
        pathname={pathname}
        ar={ar}
        userName={effectiveUser.name}
        unreadCount={unreadCount}
        initialMood={initialMood}
        onSignOut={() => void handleSignOut()}
      />
    </div>
  );
}

function ShellLink({
  item,
  pathname,
  ar,
  compact = false,
  badge = 0,
}: {
  item: NavigationItem;
  pathname: string;
  ar: boolean;
  compact?: boolean;
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={compact ? "compact-shell-link" : undefined}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{ar ? item.labelAr : item.label}</span>
      {badge > 0 && <strong className="notification-badge">{Math.min(badge, 99)}</strong>}
    </Link>
  );
}
