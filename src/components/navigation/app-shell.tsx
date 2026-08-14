"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlexStudyLogo } from "@/components/ui/logo";
import {
  Bell,
  Brain,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  History,
  LayoutDashboard,
  ListTodo,
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
import { useState } from "react";

type Theme = "SYSTEM" | "LIGHT" | "DARK";
type ShellUser = { name: string; locale: "EN" | "AR" };
type NavigationItem = {
  href: string;
  label: string;
  labelAr: string;
  icon: typeof LayoutDashboard;
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
const primaryItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", labelAr: "المهام", icon: ListTodo },
  { href: "/focus", label: "Focus", labelAr: "التركيز", icon: Timer },
  { href: "/calendar", label: "Calendar", labelAr: "التقويم", icon: CalendarDays },
  { href: "/friends", label: "Friends", labelAr: "الأصدقاء", icon: Users },
];
const moreItems: NavigationItem[] = [
  { href: "/goals", label: "Goals", labelAr: "الأهداف", icon: Target },
  { href: "/sessions", label: "Sessions", labelAr: "الجلسات", icon: History },
  { href: "/lobbies", label: "Lobbies", labelAr: "الغرف", icon: DoorOpen },
  { href: "/challenges", label: "Challenges", labelAr: "التحديات", icon: Trophy },
  { href: "/insights", label: "Insights", labelAr: "الرؤى", icon: Brain },
  { href: "/exam-plans/new", label: "Exam plan", labelAr: "خطة امتحان", icon: ClipboardList },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
function applyTheme(theme: Theme) {
  if (theme === "SYSTEM") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme = theme.toLowerCase();
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
  const [theme, setTheme] = useState(initialTheme);
  if (!user || pathname === "/" || publicPaths.some((path) => pathname.startsWith(path)))
    return children;
  const ar = user.locale === "AR";
  const themeLabels = ar
    ? { SYSTEM: "مظهر النظام", LIGHT: "المظهر الفاتح", DARK: "المظهر الداكن" }
    : { SYSTEM: "System theme", LIGHT: "Light theme", DARK: "Dark theme" };
  const ThemeIcon = theme === "SYSTEM" ? Monitor : theme === "LIGHT" ? Sun : Moon;
  async function cycleTheme() {
    const previous = theme;
    const next = theme === "SYSTEM" ? "LIGHT" : theme === "LIGHT" ? "DARK" : "SYSTEM";
    setTheme(next);
    applyTheme(next);
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
  return (
    <div className="app-frame" dir={ar ? "rtl" : "ltr"}>
      <a className="skip-link" href="#main-content">
        {ar ? "تخطي إلى المحتوى" : "Skip to content"}
      </a>
      <aside className="app-sidebar">
        <Link className="app-wordmark" href="/dashboard" aria-label="Alex Study">
          <AlexStudyLogo size={32} />
        </Link>
        <nav aria-label={ar ? "التنقل الرئيسي" : "Primary navigation"}>
          {primaryItems.map((item) => (
            <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} />
          ))}
          <div className="sidebar-rule" />
          {moreItems.map((item) => (
            <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} />
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
          <button
            type="button"
            onClick={() => void cycleTheme()}
            title={themeLabels[theme]}
            aria-label={themeLabels[theme]}
          >
            <ThemeIcon aria-hidden="true" />
            <span>{themeLabels[theme]}</span>
          </button>
          <div className="shell-profile">
            <span aria-hidden="true">{user.name.trim().slice(0, 1).toUpperCase()}</span>
            <strong>{user.name}</strong>
          </div>
        </div>
      </aside>
      <div id="main-content" className="app-content" tabIndex={-1}>
        {children}
      </div>
      <nav className="mobile-navigation" aria-label={ar ? "التنقل الرئيسي" : "Primary navigation"}>
        {primaryItems.slice(0, 4).map((item) => (
          <ShellLink key={item.href} item={item} pathname={pathname} ar={ar} compact />
        ))}
        <details>
          <summary aria-label={ar ? "المزيد" : "More"}>
            <MoreHorizontal aria-hidden="true" />
            <span>{ar ? "المزيد" : "More"}</span>
          </summary>
          <div className="mobile-more-menu">
            {[primaryItems[4], ...moreItems].map((item) => (
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
