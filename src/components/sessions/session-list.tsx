import Link from "next/link";
import type { Session } from "./types";

export function SessionList({ sessions, locale }: { sessions: Session[]; locale: "en" | "ar" }) {
  if (!sessions.length)
    return (
      <div className="session-state">
        <h2>{locale === "ar" ? "لا توجد جلسات بعد" : "No sessions yet"}</h2>
        <p>
          {locale === "ar"
            ? "ابدأ أول جلسة تركيز لتظهر هنا."
            : "Start your first focus session and it will appear here."}
        </p>
        <Link className="primary-button" href="/focus">
          {locale === "ar" ? "ابدأ التركيز" : "Start focusing"}
        </Link>
      </div>
    );
  return (
    <div className="session-list">
      {sessions.map((session) => (
        <Link className="session-row" href={`/sessions/${session.id}`} key={session.id}>
          <div>
            <strong>
              {session.task?.title ??
                session.subject?.name ??
                (locale === "ar" ? "جلسة مستقلة" : "Independent session")}
            </strong>
            <span>
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Africa/Cairo",
              }).format(new Date(session.startedAt))}
            </span>
          </div>
          <div className="session-metrics">
            <span>
              {Math.round(session.durationSeconds / 60)} {locale === "ar" ? "د" : "min"}
            </span>
            <span>{session.focusScore ?? "—"}</span>
            <span>
              {session.source === "MANUAL"
                ? locale === "ar"
                  ? "يدوي"
                  : "Manual"
                : locale === "ar"
                  ? "مؤقت"
                  : "Timer"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
