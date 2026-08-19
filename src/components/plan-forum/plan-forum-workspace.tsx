"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  CalendarPlus,
  Globe,
  Lock,
  Plus,
  StickyNote,
  Users,
} from "lucide-react";
import { planColorToken } from "@/lib/plan-forum/colors";
import { addDayKey, dayKeySpan, MAX_PLAN_DAYS } from "@/lib/plan-forum/dates";
import type { PlanSummary } from "@/lib/plan-forum/types";
import { EcgTrace, MedicalGlyph } from "@/components/ui/medical-doodles";

/**
 * The forum: a pad to start a plan on, and three shelves of the plans that exist.
 *
 * Dates are `YYYY-MM-DD` strings the whole way through -- the query layer converts once, in Cairo,
 * so nothing here does timezone arithmetic and a reader abroad still sees the author's days.
 */

const copy = {
  en: {
    newTitle: "Start a plan",
    newHint: "Name it, pick the stretch of days it covers, and the notes appear.",
    titleLabel: "What is this plan for?",
    titlePlaceholder: "Anatomy final",
    descLabel: "A note to yourself (optional)",
    descPlaceholder: "Whole syllabus, weakest chapters first",
    from: "From",
    to: "To",
    create: "Make the notes",
    creating: "Making…",
    days: (n: number) => `${n} ${n === 1 ? "day" : "days"} · ${n} ${n === 1 ? "note" : "notes"}`,
    tooLong: `A plan can cover at most ${MAX_PLAN_DAYS} days.`,
    backwards: "The end date comes before the start date.",
    failed: "Could not create the plan. Try again.",
    mine: "My plans",
    saved: "Saved from my year",
    feed: "Shared with year",
    mineEmpty: "No plans yet. The pad above is where one starts.",
    savedEmpty: "Nothing saved yet. Open a classmate's plan and bookmark it.",
    feedEmpty: "Nobody in your year has shared a plan yet. Be first.",
    open: "Open",
    apply: "On calendar",
    save: "Save",
    unsave: "Saved",
    private: "Private",
    shared: "Shared",
    tasks: (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`,
    savedBy: (n: number) => `${n} saved`,
    by: "by",
  },
  ar: {
    newTitle: "ابدأ خطّة",
    newHint: "سمّها، اختر مدّتها، وستظهر الأوراق.",
    titleLabel: "الخطّة لأي شيء؟",
    titlePlaceholder: "امتحان التشريح",
    descLabel: "ملاحظة لنفسك (اختياري)",
    descPlaceholder: "المنهج كامل، الأصعب أولًا",
    from: "من",
    to: "إلى",
    create: "أنشئ الأوراق",
    creating: "جارٍ الإنشاء…",
    days: (n: number) => `${n} يوم · ${n} ورقة`,
    tooLong: `أقصى مدّة للخطّة ${MAX_PLAN_DAYS} يومًا.`,
    backwards: "تاريخ النهاية قبل تاريخ البداية.",
    failed: "تعذّر إنشاء الخطّة. حاول مرّة أخرى.",
    mine: "خططي",
    saved: "محفوظة من سنتي",
    feed: "مشتركة مع السنة",
    mineEmpty: "لا خطط بعد. ابدأ من الورقة أعلاه.",
    savedEmpty: "لا شيء محفوظ. افتح خطّة زميل واحفظها.",
    feedEmpty: "لم يشارك أحد في سنتك خطّة بعد. كن الأول.",
    open: "افتح",
    apply: "على التقويم",
    save: "احفظ",
    unsave: "محفوظة",
    private: "خاصّة",
    shared: "مشتركة",
    tasks: (n: number) => `${n} مهمة`,
    savedBy: (n: number) => `${n} حفظها`,
    by: "بواسطة",
  },
} as const;

/** Today in Cairo as a day key, for the date inputs' default and the `min` floor. */
function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export function PlanForumWorkspace({
  locale,
  academicYear,
  initialMine,
  initialSaved,
  initialClassFeed,
}: {
  locale: "en" | "ar";
  academicYear: number;
  initialMine: PlanSummary[];
  initialSaved: PlanSummary[];
  initialClassFeed: PlanSummary[];
}) {
  const router = useRouter();
  const t = copy[locale];
  const ar = locale === "ar";
  const [mine, setMine] = useState(initialMine);
  const [saved, setSaved] = useState(initialSaved);
  const [classFeed, setClassFeed] = useState(initialClassFeed);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(() => addDayKey(todayKey(), 6));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const span = useMemo(() => dayKeySpan(startDate, endDate), [startDate, endDate]);
  const spanError = span < 1 ? t.backwards : span > MAX_PLAN_DAYS ? t.tooLong : "";

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || spanError) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/plan-forum", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, description: description || null, startDate, endDate }),
    }).catch(() => null);
    if (response?.ok) {
      const { plan } = await response.json();
      router.push(`/plan-forum/${plan.id}`);
      return;
    }
    setError(t.failed);
    setBusy(false);
  }

  /** Bookmarking from a shelf. Moves the card between shelves without a round trip. */
  async function toggleSave(plan: PlanSummary) {
    const next = !plan.savedByMe;
    const response = await fetch(`/api/plan-forum/${plan.id}/save`, {
      method: next ? "POST" : "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      setError(t.failed);
      return;
    }
    setClassFeed((rows) => rows.map((row) => (row.id === plan.id ? { ...row, savedByMe: next } : row)));
    setMine((rows) => rows.map((row) => (row.id === plan.id ? { ...row, savedByMe: next } : row)));
    setSaved((rows) =>
      next ? [{ ...plan, savedByMe: true }, ...rows] : rows.filter((row) => row.id !== plan.id),
    );
  }

  function card(plan: PlanSummary, options: { showAuthor?: boolean; showSave?: boolean } = {}) {
    const VisibilityIcon = plan.visibility === "CLASS" ? Users : Lock;
    // The card's paper is hashed off its id -- varied across a shelf, identical between visits --
    // reusing the same helper that colours the notes inside a plan.
    return (
      <article className="plan-card" key={plan.id} data-color={planColorToken(plan.id)}>
        <span className="sticky-tape-top" aria-hidden="true" />
        <MedicalGlyph seed={plan.id} className="plan-card-watermark" />
        <header className="plan-card-head">
          <h3>
            <Link href={`/plan-forum/${plan.id}`}>{plan.title}</Link>
          </h3>
          <span className="plan-visibility-pill" data-visibility={plan.visibility}>
            <VisibilityIcon aria-hidden="true" />
            {plan.visibility === "CLASS" ? t.shared : t.private}
          </span>
        </header>
        {plan.description && <p className="plan-card-note">{plan.description}</p>}
        <dl className="plan-card-meta">
          <div>
            <dt>{t.from}</dt>
            <dd>{plan.startDate}</dd>
          </div>
          <div>
            <dt>{t.to}</dt>
            <dd>{plan.endDate}</dd>
          </div>
          <div>
            <dt>{t.days(plan.dayCount).split("·")[0].trim()}</dt>
            <dd>{t.tasks(plan.itemCount)}</dd>
          </div>
        </dl>
        {options.showAuthor && (
          <p className="plan-card-author">
            {t.by} <strong>{plan.author.name}</strong>
            {plan.saveCount > 0 && <span> · {t.savedBy(plan.saveCount)}</span>}
          </p>
        )}
        <div className="plan-card-actions">
          <Link className="plan-card-btn" href={`/plan-forum/${plan.id}`}>
            <StickyNote aria-hidden="true" />
            {t.open}
          </Link>
          <Link className="plan-card-btn" href={`/calendar?source=plan&planId=${plan.id}`}>
            <CalendarPlus aria-hidden="true" />
            {t.apply}
          </Link>
          {options.showSave && (
            <button
              type="button"
              className="plan-card-btn"
              data-active={plan.savedByMe ? "yes" : "no"}
              onClick={() => toggleSave(plan)}
            >
              {plan.savedByMe ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
              {plan.savedByMe ? t.unsave : t.save}
            </button>
          )}
        </div>
      </article>
    );
  }

  function shelf(heading: string, rows: PlanSummary[], empty: string, options?: { showAuthor?: boolean; showSave?: boolean }) {
    return (
      <section className="plan-shelf">
        <header className="plan-shelf-head">
          <h2>{heading}</h2>
          <span className="plan-shelf-count">{rows.length}</span>
        </header>
        {rows.length ? (
          <div className="plan-shelf-grid">{rows.map((plan) => card(plan, options ?? {}))}</div>
        ) : (
          <div className="plan-shelf-empty">
            <EcgTrace variant="flatline" />
            <p>{empty}</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="plan-forum-layout" dir={ar ? "rtl" : "ltr"}>
      <form className="plan-new-pad" onSubmit={create}>
        <span className="sticky-tape-top" aria-hidden="true" />
        <header className="plan-new-head">
          <h2>{t.newTitle}</h2>
          <p>{t.newHint}</p>
        </header>
        <label className="plan-field">
          <span>{t.titleLabel}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t.titlePlaceholder}
            maxLength={120}
            required
          />
        </label>
        <label className="plan-field">
          <span>{t.descLabel}</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t.descPlaceholder}
            maxLength={500}
          />
        </label>
        <div className="plan-period-row">
          <label className="plan-field">
            <span>{t.from}</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </label>
          <label className="plan-field">
            <span>{t.to}</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              required
            />
          </label>
          <p className="plan-span-readout" data-invalid={spanError ? "yes" : "no"}>
            {spanError || t.days(span)}
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="plan-create-btn" type="submit" disabled={busy || Boolean(spanError)}>
          <Plus aria-hidden="true" />
          {busy ? t.creating : t.create}
        </button>
      </form>

      {shelf(t.mine, mine, t.mineEmpty)}
      {shelf(t.saved, saved, t.savedEmpty, { showAuthor: true, showSave: true })}
      {shelf(
        `${t.feed} ${academicYear}`,
        classFeed,
        t.feedEmpty,
        { showAuthor: true, showSave: true },
      )}
      <p className="plan-forum-footnote">
        <Globe aria-hidden="true" />
        {ar
          ? `المشاركة تعني كل من في السنة ${academicYear}.`
          : `Sharing means everyone in year ${academicYear}.`}
      </p>
    </div>
  );
}
