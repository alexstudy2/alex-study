import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { calendarEvents } from "@/lib/calendar/queries";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const events = await calendarEvents(user.id, now, "month");
  const locale = user.locale === "AR" ? "ar" : "en";
  return (
    <main className="page-shell">
      <header className="calendar-header">
        <div>
          <Link className="wordmark" href="/dashboard">
            Alex Study
          </Link>
          <p className="eyebrow">{locale === "ar" ? "تقويم الدراسة" : "Study calendar"}</p>
          <h1>{locale === "ar" ? "شاهد وقتك قبل أن يمضي." : "See your time before it passes."}</h1>
        </div>
        <nav>
          <Link href="/dashboard">{locale === "ar" ? "الرئيسية" : "Dashboard"}</Link>
          <Link href="/tasks">{locale === "ar" ? "المهام" : "Tasks"}</Link>
          <Link href="/goals">{locale === "ar" ? "الأهداف" : "Goals"}</Link>
        </nav>
      </header>
      <CalendarWorkspace initialEvents={events} initialAnchor={now.toISOString()} locale={locale} />
    </main>
  );
}
