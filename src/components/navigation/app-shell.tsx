"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AlexStudyLogo } from "@/components/ui/logo";
import { StudyBackgroundSelector } from "@/components/ui/study-background-selector";
import {
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  History,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "SYSTEM" | "LIGHT" | "DARK";
type ShellUser = { name: string; locale: "EN" | "AR" };
type NavigationItem = {
  href: string;
  label: string;
  labelAr: string;
  icon: typeof LayoutDashboard;
};

type NavigationGroup = {
  title: string;
  titleAr: string;
  items: NavigationItem[];
};

const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/manual-reset",
  "/reset-password",
  "/share",
  "/onboarding",
];

const navigationGroups: NavigationGroup[] = [
  {
    title: "Study",
    titleAr: "المذاكرة",
    items: [
      { href: "/dashboard", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
      { href: "/tasks", label: "Tasks", labelAr: "المهام", icon: ListTodo },
      { href: "/focus", label: "Focus", labelAr: "التركيز", icon: Timer },
    ],
  },
  {
    title: "Planning",
    titleAr: "التخطيط",
    items: [
      { href: "/calendar", label: "Calendar", labelAr: "التقويم", icon: CalendarDays },
      { href: "/exam-plans/new", label: "Exam Plan", labelAr: "خطة امتحان", icon: ClipboardList },
      { href: "/goals", label: "Goals", labelAr: "الأهداف", icon: Target },
    ],
  },
  {
    title: "Insights",
    titleAr: "الرؤى والتقدم",
    items: [
      { href: "/sessions", label: "Sessions", labelAr: "سجل الجلسات", icon: History },
      { href: "/insights", label: "AI Insights", labelAr: "الرؤى الذكية", icon: Brain },
      { href: "/analytics", label: "Analytics", labelAr: "التحليلات", icon: BarChart3 },
    ],
  },
  {
    title: "Community",
    titleAr: "المجتمع",
    items: [
      { href: "/lobbies", label: "Lobbies", labelAr: "الغرف", icon: DoorOpen },
      { href: "/friends", label: "Friends", labelAr: "الأصدقاء", icon: Users },
      { href: "/challenges", label: "Challenges", labelAr: "التحديات", icon: Trophy },
    ],
  },
];

const mobilePrimaryItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", labelAr: "المهام", icon: ListTodo },
  { href: "/focus", label: "Focus", labelAr: "التركيز", icon: Timer },
  { href: "/calendar", label: "Calendar", labelAr: "التقويم", icon: CalendarDays },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function applyTheme(theme: Theme) {
  if (theme === "DARK") {
    document.documentElement.dataset.theme = "dark";
  } else {
    document.documentElement.dataset.theme = "light";
  }
}

export function AppShell({
  children,
  user,
  unreadCount,
  initialTheme,
}: {
  children: React.ReactNode;
  user: ShellUser | null;
  unreadCount: number;
  initialTheme: Theme;
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

  const [theme, setTheme] = useState<Theme>(initialTheme ?? "LIGHT");

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("alex-study-theme") as Theme | null;
      const targetTheme = savedTheme || initialTheme || "LIGHT";
      setTheme(targetTheme);
      applyTheme(targetTheme);
    } catch {
      applyTheme(initialTheme || "LIGHT");
    }
  }, [initialTheme]);

  if (!effectiveUser || pathname === "/" || publicPaths.some((path) => pathname.startsWith(path)))
    return children;

  const ar = effectiveUser.locale === "AR";
  const themeLabels = ar
    ? { SYSTEM: "مظهر النظام", LIGHT: "المظهر الفاتح", DARK: "المظهر الداكن" }
    : { SYSTEM: "System theme", LIGHT: "Light theme", DARK: "Dark theme" };
  const ThemeIcon = theme === "SYSTEM" ? Monitor : theme === "LIGHT" ? Sun : Moon;

  async function cycleTheme() {
    const previous = theme;
    const next: Theme = theme === "LIGHT" ? "DARK" : theme === "DARK" ? "LIGHT" : "LIGHT";
    setTheme(next);
    applyTheme(next);
    try {
      localStorage.setItem("alex-study-theme", next);
    } catch {}
    try {
      const response = await fetch("/api/me/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!response.ok) throw new Error("API failure");
    } catch {
      setTheme(previous);
      applyTheme(previous);
    }
  }

  async function handleSignOut() {
    try {
      localStorage.removeItem("alex-study-theme");
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
            <StudyBackgroundSelector locale={ar ? "ar" : "en"} variant="sidebar" />
          </div>

          <div className="flex items-center justify-between gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => void cycleTheme()}
              title={themeLabels[theme]}
              aria-label={themeLabels[theme]}
              className="flex-1 flex items-center justify-center gap-2 p-1.5 rounded-md border border-line bg-surface hover:bg-surface-hover text-xs font-bold transition-colors"
            >
              <ThemeIcon className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{themeLabels[theme]}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              title={ar ? "تسجيل الخروج" : "Sign out"}
              aria-label={ar ? "تسجيل الخروج" : "Sign out"}
              className="flex items-center justify-center p-2 rounded-md hover:bg-danger-subtle hover:text-danger transition-colors text-muted"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
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
        <details>
          <summary aria-label={ar ? "المزيد" : "More"}>
            <MoreHorizontal aria-hidden="true" />
            <span>{ar ? "المزيد" : "More"}</span>
          </summary>
          <div className="mobile-more-menu">
            <div className="p-2 border-b border-line">
              <span className="sidebar-group-title block mb-1">
                {ar ? "أجواء المذاكرة" : "Study Mood"}
              </span>
              <StudyBackgroundSelector locale={ar ? "ar" : "en"} variant="sidebar" />
            </div>
            {navigationGroups.flatMap((g) => g.items).filter(
              (item) => !mobilePrimaryItems.some((p) => p.href === item.href)
            ).map((item) => (
              <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} />
            ))}
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
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex items-center gap-2 p-2 text-danger font-bold rounded-md hover:bg-danger-subtle"
            >
              <LogOut className="w-4 h-4" />
              <span>{ar ? "تسجيل الخروج" : "Sign out"}</span>
            </button>
          </div>
        </details>
      </nav>
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
