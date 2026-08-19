"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Check,
  Lock,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { dayKeyRange, dayKeySpan, MAX_PLAN_DAYS } from "@/lib/plan-forum/dates";
import type { PlanDetail, PlanItem } from "@/lib/plan-forum/types";
import { MedicalGlyph } from "@/components/ui/medical-doodles";

/**
 * The day board: one sticky note per day of the plan's period, each holding as many tasks as the
 * author cares to write.
 *
 * The notes are derived from the period, not stored -- `dayKeyRange` regenerates them on every
 * render, so widening the plan grows the board and no empty rows are ever persisted. Items are held
 * in one flat array and grouped by day at render time; a note's contents are a filter, which keeps
 * add and delete to a single array update apiece.
 */

const copy = {
  en: {
    back: "All plans",
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"}`,
    tasks: (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`,
    private: "Private",
    shared: "Shared with my year",
    share: "Share with my year",
    unshare: "Make private",
    apply: "Apply on calendar",
    edit: "Edit plan",
    del: "Delete plan",
    delConfirm: "Delete this plan and all its notes?",
    save: "Save changes",
    cancel: "Cancel",
    titleLabel: "Plan title",
    from: "From",
    to: "To",
    add: "Add task",
    taskLabel: "Task",
    taskPlaceholder: "Read chapter 4",
    subjectLabel: "Subject",
    subjectPlaceholder: "Type or pick a course",
    addSubmit: "Pin it",
    empty: "Nothing on this note yet.",
    emptyRead: "Nothing on this note.",
    today: "Today",
    readonlyBy: (name: string) => `${name} wrote this plan. You are reading it.`,
    bookmark: "Save to my forum",
    bookmarked: "Saved to my forum",
    failed: "That did not go through. Try again.",
    removed: (n: number) =>
      `${n} ${n === 1 ? "note was" : "notes were"} outside the new period and ${n === 1 ? "was" : "were"} removed.`,
    tooLong: `A plan can cover at most ${MAX_PLAN_DAYS} days.`,
    backwards: "The end date comes before the start date.",
    full: "This plan is full.",
  },
  ar: {
    back: "كل الخطط",
    days: (n: number) => `${n} يوم`,
    tasks: (n: number) => `${n} مهمة`,
    private: "خاصّة",
    shared: "مشتركة مع سنتي",
    share: "شارك مع سنتي",
    unshare: "اجعلها خاصّة",
    apply: "طبّق على التقويم",
    edit: "تعديل الخطّة",
    del: "حذف الخطّة",
    delConfirm: "حذف هذه الخطّة وكل أوراقها؟",
    save: "حفظ التعديلات",
    cancel: "إلغاء",
    titleLabel: "عنوان الخطّة",
    from: "من",
    to: "إلى",
    add: "أضف مهمة",
    taskLabel: "المهمة",
    taskPlaceholder: "اقرأ الفصل الرابع",
    subjectLabel: "المادّة",
    subjectPlaceholder: "اكتب أو اختر مادّة",
    addSubmit: "ثبّتها",
    empty: "لا شيء على هذه الورقة بعد.",
    emptyRead: "لا شيء على هذه الورقة.",
    today: "اليوم",
    readonlyBy: (name: string) => `${name} كتب هذه الخطّة. أنت تقرأها فقط.`,
    bookmark: "احفظها في منتداي",
    bookmarked: "محفوظة في منتداي",
    failed: "لم تنجح العملية. حاول مرّة أخرى.",
    removed: (n: number) => `${n} ورقة كانت خارج المدّة الجديدة وتم حذفها.`,
    tooLong: `أقصى مدّة للخطّة ${MAX_PLAN_DAYS} يومًا.`,
    backwards: "تاريخ النهاية قبل تاريخ البداية.",
    full: "الخطّة ممتلئة.",
  },
} as const;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

/** A day key formatted for a note's heading. Noon +03:00 so the label can never slip a day. */
function dayLabel(dayKey: string, locale: "en" | "ar", options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    ...options,
    timeZone: "Africa/Cairo",
  }).format(new Date(`${dayKey}T12:00:00+03:00`));
}

export function PlanBoard({
  plan,
  subjects,
  locale,
}: {
  plan: PlanDetail;
  subjects: string[];
  locale: "en" | "ar";
}) {
  const router = useRouter();
  const t = copy[locale];
  const ar = locale === "ar";
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  const [items, setItems] = useState<PlanItem[]>(plan.items);
  const [visibility, setVisibility] = useState(plan.visibility);
  const [savedByMe, setSavedByMe] = useState(plan.savedByMe);
  const [title, setTitle] = useState(plan.title);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [endDate, setEndDate] = useState(plan.endDate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: plan.title, startDate: plan.startDate, endDate: plan.endDate });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const days = useMemo(() => dayKeyRange(startDate, endDate), [startDate, endDate]);
  const byDay = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const item of items) {
      const list = map.get(item.dayDate);
      if (list) list.push(item);
      else map.set(item.dayDate, [item]);
    }
    return map;
  }, [items]);
  const today = todayKey();
  const draftSpan = dayKeySpan(draft.startDate, draft.endDate);
  const draftError =
    draftSpan < 1 ? t.backwards : draftSpan > MAX_PLAN_DAYS ? t.tooLong : "";

  const VisibilityIcon = visibility === "CLASS" ? Users : Lock;

  async function addItem(event: React.FormEvent<HTMLFormElement>, dayKey: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const itemTitle = String(data.get("title") ?? "").trim();
    const subjectLabel = String(data.get("subjectLabel") ?? "").trim();
    if (!itemTitle || !subjectLabel) return;
    setBusy(true);
    const response = await fetch(`/api/plan-forum/${plan.id}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: itemTitle, subjectLabel, dayDate: dayKey }),
    }).catch(() => null);
    if (response?.ok) {
      const { item } = await response.json();
      setItems((rows) => [...rows, item]);
      form.reset();
      setError("");
      // The form stays open: adding one task to a day usually means adding three.
      (form.elements.namedItem("title") as HTMLInputElement | null)?.focus();
    } else {
      setError(response?.status === 400 ? t.full : t.failed);
    }
    setBusy(false);
  }

  async function deleteItem(itemId: string) {
    const response = await fetch(`/api/plan-forum/${plan.id}/items/${itemId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (response?.ok) setItems((rows) => rows.filter((row) => row.id !== itemId));
    else setError(t.failed);
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch(`/api/plan-forum/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError(t.failed);
      return null;
    }
    setError("");
    return (await response.json()) as { removedItems: number };
  }

  async function toggleShare() {
    const next = visibility === "CLASS" ? "PRIVATE" : "CLASS";
    if (await patch({ visibility: next })) setVisibility(next);
  }

  async function savePlan() {
    if (draftError) return;
    const result = await patch({
      title: draft.title,
      startDate: draft.startDate,
      endDate: draft.endDate,
    });
    if (!result) return;
    setTitle(draft.title);
    setStartDate(draft.startDate);
    setEndDate(draft.endDate);
    setEditing(false);
    // Mirror the server's own cleanup rather than refetching: the route deleted exactly the notes
    // that fall outside the new period, and that is a filter this side can apply verbatim.
    if (result.removedItems > 0) {
      setItems((rows) =>
        rows.filter((row) => row.dayDate >= draft.startDate && row.dayDate <= draft.endDate),
      );
      setNotice(t.removed(result.removedItems));
    } else setNotice("");
  }

  async function deletePlan() {
    if (!window.confirm(t.delConfirm)) return;
    setBusy(true);
    const response = await fetch(`/api/plan-forum/${plan.id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) {
      router.push("/plan-forum");
      return;
    }
    setBusy(false);
    setError(t.failed);
  }

  async function toggleSave() {
    const next = !savedByMe;
    const response = await fetch(`/api/plan-forum/${plan.id}/save`, {
      method: next ? "POST" : "DELETE",
    }).catch(() => null);
    if (response?.ok) setSavedByMe(next);
    else setError(t.failed);
  }

  return (
    <div className="plan-board" dir={ar ? "rtl" : "ltr"}>
      <header className="plan-board-head">
        <Link className="plan-board-back" href="/plan-forum">
          <BackIcon aria-hidden="true" />
          {t.back}
        </Link>
        {editing ? (
          <div className="plan-edit-row">
            <label className="plan-field">
              <span>{t.titleLabel}</span>
              <input
                value={draft.title}
                maxLength={120}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <label className="plan-field">
              <span>{t.from}</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              />
            </label>
            <label className="plan-field">
              <span>{t.to}</span>
              <input
                type="date"
                value={draft.endDate}
                min={draft.startDate}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              />
            </label>
            <div className="plan-edit-actions">
              <button type="button" className="plan-board-btn" onClick={savePlan} disabled={busy || Boolean(draftError)}>
                <Check aria-hidden="true" />
                {t.save}
              </button>
              <button
                type="button"
                className="plan-board-btn"
                onClick={() => {
                  setDraft({ title, startDate, endDate });
                  setEditing(false);
                }}
              >
                <X aria-hidden="true" />
                {t.cancel}
              </button>
            </div>
            {draftError && (
              <p className="form-error" role="alert">
                {draftError}
              </p>
            )}
          </div>
        ) : (
          <div className="plan-board-title">
            <h1>{title}</h1>
            <p className="plan-board-period">
              <span className="plan-visibility-pill" data-visibility={visibility}>
                <VisibilityIcon aria-hidden="true" />
                {visibility === "CLASS" ? t.shared : t.private}
              </span>
              <span>
                {dayLabel(startDate, locale, { day: "numeric", month: "short" })} –{" "}
                {dayLabel(endDate, locale, { day: "numeric", month: "short", year: "numeric" })}
              </span>
              <span>· {t.days(days.length)}</span>
              <span>· {t.tasks(items.length)}</span>
            </p>
            {plan.description && <p className="plan-board-note">{plan.description}</p>}
          </div>
        )}

        <div className="plan-board-actions">
          <Link className="plan-board-btn" href={`/calendar?source=plan&planId=${plan.id}`}>
            <CalendarPlus aria-hidden="true" />
            {t.apply}
          </Link>
          {plan.isMine ? (
            <>
              <button type="button" className="plan-board-btn" onClick={toggleShare} disabled={busy}>
                <Share2 aria-hidden="true" />
                {visibility === "CLASS" ? t.unshare : t.share}
              </button>
              {!editing && (
                <button type="button" className="plan-board-btn" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden="true" />
                  {t.edit}
                </button>
              )}
              <button type="button" className="plan-board-btn danger" onClick={deletePlan} disabled={busy}>
                <Trash2 aria-hidden="true" />
                {t.del}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="plan-board-btn"
              data-active={savedByMe ? "yes" : "no"}
              onClick={toggleSave}
            >
              {savedByMe ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
              {savedByMe ? t.bookmarked : t.bookmark}
            </button>
          )}
        </div>
      </header>

      {!plan.isMine && (
        <p className="plan-readonly-banner">{t.readonlyBy(plan.author.name)}</p>
      )}
      {notice && (
        <p className="plan-board-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {/* One datalist for the whole board rather than one per note: 60 copies of the same option
          list is 60x the DOM for identical behaviour. */}
      {plan.isMine && subjects.length > 0 && (
        <datalist id="plan-subjects">
          {subjects.map((subject) => (
            <option key={subject} value={subject} />
          ))}
        </datalist>
      )}

      <div className="plan-day-grid">
        {days.map((dayKey) => {
          const dayItems = byDay.get(dayKey) ?? [];
          const isOpen = openDay === dayKey;
          return (
            <article
              className="plan-day-note"
              key={dayKey}
              data-today={dayKey === today ? "yes" : "no"}
            >
              <span className="sticky-tape-top" aria-hidden="true" />
              <MedicalGlyph seed={dayKey} className="plan-note-watermark" />
              <header className="plan-day-head">
                <span className="plan-day-weekday">{dayLabel(dayKey, locale, { weekday: "long" })}</span>
                <time className="plan-day-date" dateTime={dayKey}>
                  {dayLabel(dayKey, locale, { day: "numeric", month: "short" })}
                </time>
                {dayKey === today && <span className="plan-day-today">{t.today}</span>}
              </header>

              <ul className="plan-note-tasks">
                {dayItems.map((item) => (
                  <li className="plan-note-task" key={item.id} data-color={item.colorToken}>
                    <span className="plan-note-swatch" aria-hidden="true" />
                    <span className="plan-note-text">
                      <strong>{item.title}</strong>
                      <em>{item.subjectLabel}</em>
                    </span>
                    {plan.isMine && (
                      <button
                        type="button"
                        className="plan-note-remove"
                        onClick={() => deleteItem(item.id)}
                        aria-label={`${t.del}: ${item.title}`}
                      >
                        <X aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
                {!dayItems.length && (
                  <li className="plan-note-blank">{plan.isMine ? t.empty : t.emptyRead}</li>
                )}
              </ul>

              {plan.isMine &&
                (isOpen ? (
                  <form className="plan-note-form" onSubmit={(event) => addItem(event, dayKey)}>
                    <label>
                      <span>{t.taskLabel}</span>
                      <input name="title" placeholder={t.taskPlaceholder} maxLength={160} required autoFocus />
                    </label>
                    <label>
                      <span>{t.subjectLabel}</span>
                      {/* A plain input bound to a datalist: typing a new subject and choosing an
                          existing course are the same gesture, which is what was asked for -- and
                          there is no combobox keyboard behaviour to reimplement. */}
                      <input
                        name="subjectLabel"
                        list="plan-subjects"
                        placeholder={t.subjectPlaceholder}
                        maxLength={60}
                        required
                      />
                    </label>
                    <div className="plan-note-form-actions">
                      <button type="submit" disabled={busy}>
                        <Plus aria-hidden="true" />
                        {t.addSubmit}
                      </button>
                      <button type="button" onClick={() => setOpenDay(null)}>
                        {t.cancel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="plan-note-add-btn"
                    aria-expanded={false}
                    onClick={() => setOpenDay(dayKey)}
                  >
                    <Plus aria-hidden="true" />
                    {t.add}
                  </button>
                ))}
            </article>
          );
        })}
      </div>
    </div>
  );
}
