import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { calendarEvents } from "@/lib/calendar/queries";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const events = await calendarEvents(user.id, now, "month");
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
          </div>
        }
      />
      <CalendarWorkspace initialEvents={events} initialAnchor={now.toISOString()} locale={locale} />
    </PageShell>
  );
}
