"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addDays, addMonths, format, startOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { CalendarCheck, ChevronLeft, ChevronRight, StickyNote, Timer } from "lucide-react";
import { cairoDateKey } from "@/lib/calendar/dates";
import type { PlanOption } from "@/lib/plan-forum/types";
import type { CalendarEvent } from "./types";

export function CalendarWorkspace({
  initialEvents,
  initialAnchor,
  locale,
  plans,
  initialPlanId,
}: {
  initialEvents: CalendarEvent[];
  initialAnchor: string;
  locale: "en" | "ar";
  plans: PlanOption[];
  initialPlanId: string | null;
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [anchor, setAnchor] = useState(new Date(initialAnchor));
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [busy, setBusy] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  /** null = the viewer's own sessions and tasks. A plan id = that plan's notes, painted read-only. */
  const [planId, setPlanId] = useState<string | null>(initialPlanId);
  const [copying, setCopying] = useState(false);
  /** Copy results per day key, so re-opening a day still shows what it added and stays disabled. */
  const [copied, setCopied] = useState<Record<string, { created: number; skipped: number }>>({});
  const ar = locale === "ar";
  const activePlan = plans.find((plan) => plan.id === planId) ?? null;

  /**
   * One fetch for every reason the grid reloads: paging, switching view, and switching source.
   *
   * These used to be two near-identical copies (`move` and `change`); a third source parameter would
   * have made three. Anything not named in `next` keeps its current value -- note the `undefined`
   * test on `planId`, since `null` is a real value here meaning "back to my sessions".
   */
  async function load(next: { view?: typeof view; anchor?: Date; planId?: string | null }) {
    const nextView = next.view ?? view;
    const nextAnchor = next.anchor ?? anchor;
    const nextPlanId = next.planId === undefined ? planId : next.planId;
    const query = new URLSearchParams({ view: nextView, anchor: nextAnchor.toISOString() });
    if (nextPlanId) {
      query.set("source", "plan");
      query.set("planId", nextPlanId);
    }
    setBusy(true);
    const response = await fetch(`/api/calendar?${query.toString()}`).catch(() => null);
    if (response?.ok) {
      setEvents((await response.json()).events);
      setView(nextView);
      setAnchor(nextAnchor);
      setPlanId(nextPlanId);
      setError("");
      // The source lives in the URL so a reload keeps the plan and Back undoes the switch.
      router.replace(nextPlanId ? `/calendar?source=plan&planId=${nextPlanId}` : "/calendar", {
        scroll: false,
      });
    } else {
      setError(ar ? "تعذر تحديث التقويم." : "Could not update the calendar.");
    }
    setBusy(false);
  }

  function shift(direction: number) {
    const nextAnchor =
      view === "month"
        ? addMonths(anchor, direction)
        : addDays(anchor, direction * (view === "week" ? 7 : 30));
    return load({ anchor: nextAnchor });
  }

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
      load({});
      setError("");
    } else {
      setError(ar ? "تعذر إضافة المهمة إلى التقويم." : "Could not add the task to the calendar.");
    }
  }

  /** Turns one day's plan notes into the viewer's own tasks. The only write the overlay can do. */
  async function copyDayToTasks(dayKey: string) {
    if (!planId) return;
    setCopying(true);
    const response = await fetch(`/api/plan-forum/${planId}/copy-to-tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dayDate: dayKey }),
    }).catch(() => null);
    if (response?.ok) {
      const result = (await response.json()) as { created: number; skipped: number };
      setCopied((rows) => ({ ...rows, [dayKey]: result }));
      setError("");
    } else {
      setError(ar ? "تعذر نسخ المهام." : "Could not copy the tasks.");
    }
    setCopying(false);
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

  /** Where a painted event goes when tapped. A plan note leads back to the note, not to a task. */
  function eventHref(event: CalendarEvent) {
    if (event.type === "plan") return `/plan-forum/${planId}`;
    return event.type === "task" ? `/tasks/${event.id}` : `/sessions/${event.id}`;
  }

  function eventLabel(event: CalendarEvent) {
    if (event.type === "plan") return ar ? "خطّة" : "Plan";
    return event.type === "task" ? (ar ? "مهمة" : "Task") : ar ? "جلسة" : "Session";
  }

  function timeOf(value: string | Date) {
    return new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Cairo",
    }).format(new Date(value));
  }

  const monthStart = startOfMonth(toZonedTime(anchor, "Africa/Cairo"));
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  const weekAnchor = toZonedTime(anchor, "Africa/Cairo");
  const weekStart = addDays(weekAnchor, -weekAnchor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const PrevIcon = ar ? ChevronRight : ChevronLeft;
  const NextIcon = ar ? ChevronLeft : ChevronRight;

  const dayNotes = selectedDay ? groups.get(selectedDay) ?? [] : [];
  const dayCopied = selectedDay ? copied[selectedDay] : undefined;

  return (
    <section className="calendar-workspace" dir={ar ? "rtl" : "ltr"} data-source={planId ? "plan" : "own"}>
      {/* Only shown to someone who has a plan to point at: a one-option switch is not a switch. */}
      {plans.length > 0 && (
        <div className="calendar-source-bar">
          <div className="calendar-source-tabs" role="tablist" aria-label={ar ? "المصدر" : "Source"}>
            <button
              role="tab"
              aria-selected={!planId}
              onClick={() => load({ planId: null })}
              disabled={busy}
            >
              <Timer aria-hidden="true" />
              {ar ? "جلساتي" : "My sessions"}
            </button>
            <button
              role="tab"
              aria-selected={Boolean(planId)}
              onClick={() => load({ planId: planId ?? plans[0].id })}
              disabled={busy}
            >
              <StickyNote aria-hidden="true" />
              {ar ? "خطّة" : "Plan"}
            </button>
          </div>
          {planId && (
            <label className="calendar-source-picker">
              <span className="sr-only">{ar ? "اختر خطّة" : "Choose a plan"}</span>
              <select
                value={planId}
                onChange={(event) => load({ planId: event.target.value })}
                disabled={busy}
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.isMine ? plan.title : `${plan.title} — ${plan.authorName}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {activePlan && (
            <p className="calendar-source-note">
              {ar
                ? `تعرض ملاحظات الخطّة فقط. لا يُكتب شيء في مهامك.`
                : `Showing plan notes only — nothing is written to your tasks.`}{" "}
              <Link href={`/plan-forum/${activePlan.id}`}>{ar ? "افتح الخطّة" : "Open the plan"}</Link>
            </p>
          )}
        </div>
      )}
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button
            aria-label={ar ? "الفترة السابقة" : "Previous period"}
            onClick={() => shift(-1)}
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
            onClick={() => shift(1)}
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
              onClick={() => load({ view: item })}
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
                      href={eventHref(event)}
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
              {dayNotes.map((event) => (
                <Link
                  className={`calendar-event ${event.type}`}
                  href={eventHref(event)}
                  key={`${event.type}-${event.id}`}
                >
                  <span className="event-time">{timeOf(event.startsAt)}</span>
                  <span>{event.title}</span>
                </Link>
              ))}
              {!dayNotes.length && (
                <p className="empty-day">{ar ? "لا توجد أحداث" : "No events for this day"}</p>
              )}
            </div>
            {/* In plan mode the quick-add is replaced, not hidden: the day's notes are somebody's
                plan, and the only write on offer is copying them into your own tasks. */}
            {planId ? (
              dayNotes.length > 0 && (
                <div className="calendar-copy-box">
                  <p className="calendar-copy-count">
                    {ar
                      ? `${dayNotes.length} ملاحظة في هذا اليوم`
                      : `${dayNotes.length} ${dayNotes.length === 1 ? "note" : "notes"} on this day`}
                  </p>
                  {dayCopied ? (
                    <p className="calendar-copy-done" role="status">
                      <CalendarCheck aria-hidden="true" />
                      {ar
                        ? `أُضيفت ${dayCopied.created} مهمة${dayCopied.skipped ? ` · تُخطّيت ${dayCopied.skipped}` : ""}`
                        : `${dayCopied.created} ${dayCopied.created === 1 ? "task" : "tasks"} added${dayCopied.skipped ? ` · ${dayCopied.skipped} already there` : ""}`}
                    </p>
                  ) : (
                    <button type="button" onClick={() => copyDayToTasks(selectedDay)} disabled={copying}>
                      {copying
                        ? ar
                          ? "جارٍ النسخ…"
                          : "Copying…"
                        : ar
                        ? "انسخ إلى المهام"
                        : "Copy to tasks"}
                    </button>
                  )}
                </div>
              )
            ) : (
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
            )}
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
                        href={eventHref(event)}
                        key={`${event.type}-${event.id}`}
                      >
                        <span className="event-time">{timeOf(event.startsAt)}</span>
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
                  href={eventHref(event)}
                  key={`${event.type}-${event.id}`}
                >
                  <span>{timeOf(event.startsAt)}</span>
                  <strong>{event.title}</strong>
                  <em>{eventLabel(event)}</em>
                </Link>
              ))}
            </section>
          ))}
          {!events.length && (
            <div className="session-state">
              <h3>{ar ? "الفترة هادئة" : "A clear stretch"}</h3>
              <p>
                {planId
                  ? ar
                    ? "لا ملاحظات من هذه الخطّة في هذه الفترة."
                    : "No notes from this plan fall in this period."
                  : ar
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
