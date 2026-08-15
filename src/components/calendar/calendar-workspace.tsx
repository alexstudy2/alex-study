"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const ar = locale === "ar";

  async function addTaskForDay(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const input = form.elements.namedItem("dayTask") as HTMLInputElement;
    const title = input.value;
    if (!title.trim() || !selectedDay) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, dueAt: `${selectedDay}T09:00:00+03:00`, status: "TODO" }),
    });
    if (res.ok) {
      input.value = "";
      move(0);
      setError("");
    } else {
      setError(ar ? "تعذر إضافة المهمة إلى التقويم." : "Could not add the task to the calendar.");
    }
  }

  async function move(direction: number, nextView = view) {
    const next =
      nextView === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, direction * (nextView === "week" ? 7 : 30));
    setBusy(true);
    const response = await fetch(`/api/calendar?view=${nextView}&anchor=${next.toISOString()}`).catch(() => null);
    if (response?.ok) {
      const payload = await response.json();
      setEvents(payload.events);
      setAnchor(next);
      setError("");
    } else {
      setError(ar ? "تعذر تحديث التقويم." : "Could not update the calendar.");
    }
    setBusy(false);
  }

  async function change(nextView: typeof view) {
    setView(nextView);
    setBusy(true);
    const response = await fetch(`/api/calendar?view=${nextView}&anchor=${anchor.toISOString()}`).catch(() => null);
    if (response?.ok) {
      setEvents((await response.json()).events);
      setError("");
    } else setError(ar ? "تعذر تغيير عرض التقويم." : "Could not change the calendar view.");
    setBusy(false);
  }

  const groups = useMemo(
    () =>
      new Map<string, CalendarEvent[]>(
        Array.from(new Set(events.map((event) => cairoDateKey(new Date(event.startsAt))))).map(
          (key) => [key, events.filter((event) => cairoDateKey(new Date(event.startsAt)) === key)]
        )
      ),
    [events]
  );

  const monthStart = startOfMonth(toZonedTime(anchor, "Africa/Cairo"));
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const weekAnchor = toZonedTime(anchor, "Africa/Cairo");
  const weekStart = addDays(weekAnchor, -weekAnchor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const PrevIcon = ar ? ChevronRight : ChevronLeft;
  const NextIcon = ar ? ChevronLeft : ChevronRight;

  return (
    <section className="calendar-workspace" dir={ar ? "rtl" : "ltr"}>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button
            aria-label={ar ? "الفترة السابقة" : "Previous period"}
            onClick={() => move(-1)}
            className="flex items-center justify-center p-1.5 rounded-full hover:bg-surface-hover transition-colors"
          >
            <PrevIcon className="w-5 h-5" />
          </button>
          <h2>
            {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
              month: "long",
              year: "numeric",
              timeZone: "Africa/Cairo",
            }).format(anchor)}
          </h2>
          <button
            aria-label={ar ? "الفترة التالية" : "Next period"}
            onClick={() => move(1)}
            className="flex items-center justify-center p-1.5 rounded-full hover:bg-surface-hover transition-colors"
          >
            <NextIcon className="w-5 h-5" />
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
      {error && <p className="form-error" role="alert">{error}</p>}
      {view === "month" ? (
        <>
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
                className={`calendar-day${day.getMonth() !== monthStart.getMonth() ? " outside" : ""}${key === selectedDay ? " selected" : ""}`}
                key={key}
                onClick={() => setSelectedDay(key === selectedDay ? null : key)}
                role="button"
                tabIndex={0}
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
        {selectedDay && (
          <div className="day-drawer">
            <div className="day-drawer-header">
              <h3>
                {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "Africa/Cairo",
                }).format(new Date(`${selectedDay}T12:00:00+03:00`))}
              </h3>
              <button onClick={() => setSelectedDay(null)} aria-label={ar ? "إغلاق" : "Close"}>
                ✕
              </button>
            </div>
            <div className="day-drawer-events">
              {(groups.get(selectedDay) ?? []).map((event) => (
                <Link
                  className={`calendar-event ${event.type}`}
                  href={event.type === "task" ? `/tasks/${event.id}` : `/sessions/${event.id}`}
                  key={`${event.type}-${event.id}`}
                >
                  <span className="event-time">
                    {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Africa/Cairo",
                    }).format(new Date(event.startsAt))}
                  </span>
                  <span>{event.title}</span>
                </Link>
              ))}
              {!(groups.get(selectedDay) ?? []).length && (
                <p className="empty-day">{ar ? "لا توجد أحداث" : "No events for this day"}</p>
              )}
            </div>
            <form className="day-drawer-add" onSubmit={addTaskForDay}>
              <input
                name="dayTask"
                placeholder={ar ? "أضف مهمة لهذا اليوم..." : "Add task for this day..."}
                required
              />
              <button type="submit" aria-label={ar ? "إضافة" : "Add"}>
                +
              </button>
            </form>
          </div>
        )}
      </>
      ) : view === "week" ? (
        <div className="week-grid">
          {weekDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const items = groups.get(key) ?? [];
            const isToday = key === format(toZonedTime(new Date(), "Africa/Cairo"), "yyyy-MM-dd");
            return (
              <article className={`week-day${isToday ? " today" : ""}`} key={key}>
                <header className="week-day-header">
                  <span className="week-day-name">
                    {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                      weekday: "short",
                      timeZone: "Africa/Cairo",
                    }).format(day)}
                  </span>
                  <time className="week-day-number">{day.getDate()}</time>
                </header>
                <div className="week-day-events">
                  {items.length ? (
                    items.map((event) => (
                      <Link
                        className={`calendar-event ${event.type}`}
                        href={event.type === "task" ? `/tasks/${event.id}` : `/sessions/${event.id}`}
                        key={`${event.type}-${event.id}`}
                      >
                        <span className="event-time">
                          {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Africa/Cairo",
                          }).format(new Date(event.startsAt))}
                        </span>
                        <span>{event.title}</span>
                      </Link>
                    ))
                  ) : (
                    <p className="empty-day">{ar ? "—" : "—"}</p>
                  )}
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
