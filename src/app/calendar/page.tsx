import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { calendarEvents } from "@/lib/calendar/queries";
import { calendarWindow } from "@/lib/calendar/dates";
import { planCalendarEvents, planOptions, visiblePlan } from "@/lib/plan-forum/queries";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; planId?: string }>;
}) {
  const user = await requireUser();
  const now = new Date();
  // Next 16: searchParams is a Promise here just as params is.
  const { source, planId } = await searchParams;
  const plans = await planOptions(user);

  /* The URL decides what the first paint shows, so a shared "?source=plan&planId=..." link opens
     on the plan rather than flashing the viewer's own schedule and then swapping. An unreadable or
     deleted plan silently falls back to the sessions view -- a calendar is not the place to 404. */
  const wantsPlan = source === "plan" && Boolean(planId);
  const plan = wantsPlan ? await visiblePlan(user, planId!) : null;
  const window = calendarWindow(now, "month");
  const events = plan
    ? await planCalendarEvents(plan.id, window.start, window.end)
    : await calendarEvents(user.id, now, "month");

  const locale = user.locale === "AR" ? "ar" : "en";
  const ar = locale === "ar";

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={CalendarDays}
        eyebrow={ar ? "تقويم الدراسة" : "Study calendar"}
        title={ar ? "شاهد وقتك قبل أن يمضي." : "See your time before it passes."}
        description={
          ar
            ? "عرض موحّد لمهامك وجلساتك وامتحاناتك بتوقيت الإسكندرية والقاهرة."
            : "Integrated view of deadlines, study sessions, and exams in Cairo time."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/dashboard">
              {ar ? "الرئيسية" : "Dashboard"}
            </Link>
            <Link className="page-header-link" href="/tasks">
              {ar ? "المهام" : "Tasks"}
            </Link>
            <Link className="page-header-link" href="/goals">
              {ar ? "الأهداف" : "Goals"}
            </Link>
            <Link className="page-header-link" href="/plan-forum">
              {ar ? "منتدى الخطط" : "Plan Forum"}
            </Link>
          </div>
        }
      />
      <CalendarWorkspace
        initialEvents={events}
        initialAnchor={now.toISOString()}
        locale={locale}
        plans={plans}
        initialPlanId={plan?.id ?? null}
      />
    </PageShell>
  );
}
