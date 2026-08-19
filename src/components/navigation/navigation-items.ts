import {
  BarChart3,
  Brain,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  History,
  LayoutDashboard,
  ListTodo,
  StickyNote,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";

export type NavigationItem = {
  href: string;
  label: string;
  labelAr: string;
  icon: typeof LayoutDashboard;
};

export type NavigationGroup = {
  title: string;
  titleAr: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
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
      { href: "/plan-forum", label: "Plan Forum", labelAr: "منتدى الخطط", icon: StickyNote },
      { href: "/exam-plans/new", label: "AI Exam Plan", labelAr: "خطة امتحان AI", icon: ClipboardList },
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

export const mobilePrimaryItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", labelAr: "الرئيسية", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", labelAr: "المهام", icon: ListTodo },
  { href: "/focus", label: "Focus", labelAr: "التركيز", icon: Timer },
  { href: "/calendar", label: "Calendar", labelAr: "التقويم", icon: CalendarDays },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
