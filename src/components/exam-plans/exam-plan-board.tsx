"use client";

import { CheckCircle2, GraduationCap } from "lucide-react";
import { MedicalGlyph } from "@/components/ui/medical-doodles";
import { MAX_PLAN_DAYS, addDayKey, dayKeyRange } from "@/lib/plan-forum/dates";
import { formatLoad, type ExamItemKind } from "@/lib/exam-plans/topics";

/**
 * The proposal as sticky notes: one note per day from the first item to the exam.
 *
 * This is deliberately the Plan Forum's own note markup and CSS (`.plan-day-grid`, `.plan-day-note`,
 * `.plan-note-task`), not a lookalike. A plan that will be published to the forum should be read on
 * the same paper before it is published, and reusing the classes means the two boards cannot drift
 * apart. What is added here is exam-specific: a kind badge, a minutes figure, a per-day load chip,
 * and the selection checkbox that feeds the task-creation gate.
 */

export type BoardItem = {
  key: string;
  id: string | null;
  title: string;
  kind: ExamItemKind;
  minutes: number;
  dayKey: string;
  subjectLabel: string | null;
  colorToken: string;
  accepted: boolean;
  rejected: boolean;
  /** Selectable means "can still become a task": saved, not accepted, not rejected, plan open. */
  selectable: boolean;
};

const KIND_LABEL: Record<ExamItemKind, { en: string; ar: string }> = {
  STUDY: { en: "Study", ar: "دراسة" },
  QUESTIONS: { en: "Questions", ar: "أسئلة" },
  REVIEW: { en: "Review", ar: "مراجعة" },
};

function dayLabel(dayKey: string, ar: boolean, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
    ...options,
    timeZone: "Africa/Cairo",
  }).format(new Date(`${dayKey}T12:00:00+03:00`));
}

export function ExamPlanBoard({
  ar,
  items,
  examDateKey,
  todayKey,
  selectedIds,
  onToggle,
}: {
  ar: boolean;
  items: BoardItem[];
  examDateKey: string;
  todayKey: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const byDay = new Map<string, BoardItem[]>();
  for (const item of items) {
    const list = byDay.get(item.dayKey);
    if (list) list.push(item);
    else byDay.set(item.dayKey, [item]);
  }

  const dayKeys = [...byDay.keys()].sort();
  const earliest = dayKeys[0] ?? todayKey;
  /*
   * The window is clamped to the same 60 days the forum board renders. The generator already keeps
   * proposals inside it, but a hand-edited date can reach further back, and 300 notes is not a
   * board -- so the notes show the run-in to the exam and anything older is counted, not hidden.
   */
  const floor = addDayKey(examDateKey, -(MAX_PLAN_DAYS - 1));
  const start = earliest < floor ? floor : earliest;
  const days = dayKeyRange(start, examDateKey > start ? examDateKey : start);
  const beforeWindow = items.filter((item) => item.dayKey < start).length;

  return (
    <div className="exam-board">
      {beforeWindow > 0 && (
        <p className="muted-copy">
          {ar
            ? `${beforeWindow} عنصرًا قبل هذه الأيام. ستجدها في تبويب القائمة.`
            : `${beforeWindow} item${beforeWindow === 1 ? "" : "s"} fall before these days — open the List tab to see them.`}
        </p>
      )}
      <div className="plan-day-grid">
        {days.map((dayKey) => {
          const dayItems = byDay.get(dayKey) ?? [];
          const load = dayItems.reduce((total, item) => total + item.minutes, 0);
          const questionsOnly =
            dayItems.length > 0 && dayItems.every((item) => item.kind === "QUESTIONS");
          const isExamDay = dayKey === examDateKey;
          return (
            <article
              className="plan-day-note"
              key={dayKey}
              data-today={dayKey === todayKey ? "yes" : "no"}
              data-kind={questionsOnly ? "questions" : undefined}
              data-exam={isExamDay ? "yes" : undefined}
            >
              <span className="sticky-tape-top" aria-hidden="true" />
              <MedicalGlyph seed={dayKey} className="plan-note-watermark" />
              <header className="plan-day-head">
                <span className="plan-day-weekday">{dayLabel(dayKey, ar, { weekday: "long" })}</span>
                <time className="plan-day-date" dateTime={dayKey}>
                  {dayLabel(dayKey, ar, { day: "numeric", month: "short" })}
                </time>
                {dayKey === todayKey && (
                  <span className="plan-day-today">{ar ? "اليوم" : "Today"}</span>
                )}
                {load > 0 && <span className="exam-day-load">{formatLoad(load, ar)}</span>}
              </header>

              {isExamDay && (
                <p className="exam-note-exam-day">
                  <GraduationCap aria-hidden="true" className="w-4 h-4" />
                  {ar ? "يوم الامتحان" : "Exam day"}
                </p>
              )}

              <ul className="plan-note-tasks">
                {dayItems.map((item) => {
                  const checked = Boolean(item.id && selectedIds.includes(item.id));
                  return (
                    <li className="plan-note-task" key={item.key} data-color={item.colorToken}>
                      <span className="plan-note-swatch" aria-hidden="true" />
                      {item.selectable && item.id ? (
                        <label className="exam-note-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => onToggle(item.id as string)}
                          />
                          <span className="sr-only">
                            {ar ? `اختر: ${item.title}` : `Select: ${item.title}`}
                          </span>
                        </label>
                      ) : (
                        item.accepted && (
                          <CheckCircle2
                            aria-label={ar ? "تم إنشاء المهمة" : "Task created"}
                            className="exam-note-done w-4 h-4"
                          />
                        )
                      )}
                      <span className="plan-note-text">
                        <strong>{item.title}</strong>
                        <em>
                          <span className="exam-note-kind" data-kind={item.kind.toLowerCase()}>
                            {ar ? KIND_LABEL[item.kind].ar : KIND_LABEL[item.kind].en}
                          </span>
                          {item.subjectLabel ? ` · ${item.subjectLabel}` : ""}
                          <span className="exam-note-minutes">{formatLoad(item.minutes, ar)}</span>
                        </em>
                      </span>
                    </li>
                  );
                })}
                {!dayItems.length && (
                  <li className="plan-note-blank">
                    {isExamDay ? (ar ? "بالتوفيق" : "Good luck") : ar ? "راحة" : "Rest"}
                  </li>
                )}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
