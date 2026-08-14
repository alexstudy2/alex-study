"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cairoDateKey } from "@/lib/calendar/dates";
import type { CalendarEvent } from "./types";

export function CalendarWorkspace({
  initialEvents,
  initialAnchor,
  locale,
}: {
  initialEvents: CalendarEvent[];
  initialAnchor: string;
  locale: "en" | "ar";
}) {
  const [events, setEvents] = useState(initialEvents);
  const [anchor, setAnchor] = useState(new Date(initialAnchor));
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [busy, setBusy] = useState(false);
  const ar = locale === "ar";
  async function move(direction: number, nextView = view) {
    const next =
      nextView === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, direction * (nextView === "week" ? 7 : 30));
    setBusy(true);
    const response = await fetch(`/api/calendar?view=${nextView}&anchor=${next.toISOString()}`);
    if (response.ok) {
      const payload = await response.json();
      setEvents(payload.events);
      setAnchor(next);
    }
    setBusy(false);
  }
  async function change(nextView: typeof view) {
    setView(nextView);
    setBusy(true);
    const response = await fetch(`/api/calendar?view=${nextView}&anchor=${anchor.toISOString()}`);
    if (response.ok) setEvents((await response.json()).events);
    setBusy(false);
  }
  const groups = useMemo(
    () =>
      new Map<string, CalendarEvent[]>(
        Array.from(new Set(events.map((event) => cairoDateKey(new Date(event.startsAt))))).map(
          (key) => [key, events.filter((event) => cairoDateKey(new Date(event.startsAt)) === key)],
        ),
      ),
    [events],
  );
  const monthStart = startOfMonth(toZonedTime(anchor, "Africa/Cairo"));
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  return (
    <section className="calendar-workspace" dir={ar ? "rtl" : "ltr"}>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button aria-label={ar ? "الفترة السابقة" : "Previous period"} onClick={() => move(-1)}>
            ←
          </button>
          <h2>
            {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "Africa/Cairo",
            }).format(anchor)}
          </h2>
          <button aria-label={ar ? "الفترة التالية" : "Next period"} onClick={() => move(1)}>
            →
          </button>
        </div>
        <div className="view-tabs" role="tablist">
          {(["month", "week", "agenda"] as const).map((item) => (
            <button
              role="tab"
              aria-selected={view === item}
              key={item}
              onClick={() => change(item)}
            >
              {item === "month"
                ? ar
                  ? "شهر"
                  : "Month"
                : item === "week"
                  ? ar
                    ? "أسبوع"
                    : "Week"
                  : ar
                    ? "قائمة"
                    : "Agenda"}
            </button>
          ))}
        </div>
      </div>
      {busy && (
        <p className="calendar-status" role="status">
          {ar ? "جارٍ تحديث التقويم…" : "Updating calendar…"}
        </p>
      )}
      {view === "month" ? (
        <div className="month-grid">
          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
            <div className="weekday" key={day}>
              {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                weekday: "short",
                timeZone: "Africa/Cairo",
              }).format(addDays(new Date("2026-08-16T12:00:00Z"), day))}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = groups.get(key) ?? [];
            return (
              <article
                className={`calendar-day${day.getMonth() !== monthStart.getMonth() ? " outside" : ""}`}
                key={key}
              >
                <time>{day.getDate()}</time>
                <div>
                  {items.slice(0, 3).map((event) => (
                    <Link
                      className={`calendar-event ${event.type}`}
                      href={event.type === "task" ? `/tasks/${event.id}` : `/sessions/${event.id}`}
                      key={`${event.type}-${event.id}`}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {items.length > 3 && <span className="more-events">+{items.length - 3}</span>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="agenda-list">
          {Array.from(groups.entries()).map(([key, items]) => (
            <section key={key}>
              <h3>
                {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Africa/Cairo",
                }).format(new Date(`${key}T12:00:00+03:00`))}
              </h3>
              {items.map((event) => (
                <Link
                  className="agenda-event"
                  href={event.type === "task" ? `/tasks/${event.id}` : `/sessions/${event.id}`}
                  key={`${event.type}-${event.id}`}
                >
                  <span>
                    {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Cairo",
                    }).format(new Date(event.startsAt))}
                  </span>
                  <strong>{event.title}</strong>
                  <em>
                    {event.type === "task" ? (ar ? "مهمة" : "Task") : ar ? "جلسة" : "Session"}
                  </em>
                </Link>
              ))}
            </section>
          ))}
          {!events.length && (
            <div className="session-state">
              <h3>{ar ? "الفترة هادئة" : "A clear stretch"}</h3>
              <p>
                {ar
                  ? "لا توجد مهام مؤرخة أو جلسات هنا."
                  : "No dated tasks or sessions in this period."}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
