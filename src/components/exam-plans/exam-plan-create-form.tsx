"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenCheck, CalendarClock, ListChecks, Sparkles } from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { weekdayLabels, weekdayOrder } from "@/components/analytics/analytics-format";
import { MAX_PLAN_DAYS, addDayKey, dayKeySpan } from "@/lib/plan-forum/dates";
import {
  MAX_TOPICS,
  formatLoad,
  type ExamTopic,
  type QuestionStrategy,
} from "@/lib/exam-plans/topics";
import {
  examPlanErrorFields,
  examPlanErrorMessage,
  examPlanOfflineMessage,
  type ExamPlanErrorPayload,
} from "./exam-plan-errors";
import { SyllabusScanner } from "./syllabus-scanner";
import {
  TopicComposer,
  filledTopics,
  newTopicRow,
  topicRows,
  type TopicRow,
} from "./topic-composer";

type RecentPlan = {
  id: string;
  title: string;
  examAt: string | Date;
  status: string;
  updatedAt: string | Date;
};

/** Today in Cairo, as a day key. The exam date is a Cairo calendar date, never the browser's. */
function cairoTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const STEPS = [1, 2, 3, 4] as const;

/** Which step owns each field, so a 400 reopens the step that can fix it instead of just complaining. */
const FIELD_STEP: Record<string, number> = {
  title: 1,
  examAt: 1,
  topics: 2,
  syllabusText: 2,
  dailyCapacityMinutes: 3,
  restDays: 3,
};

export function ExamPlanCreateForm({
  locale,
  recentPlans,
  aiEnabled,
  weekStartsOn = 0,
}: {
  locale: "en" | "ar";
  recentPlans: RecentPlan[];
  aiEnabled: boolean;
  weekStartsOn?: number;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const today = cairoTodayKey();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [examAt, setExamAt] = useState(addDayKey(today, 21));
  const [rows, setRows] = useState<TopicRow[]>([newTopicRow()]);
  const [strategy, setStrategy] = useState<QuestionStrategy>("INTEGRATED");
  const [capacity, setCapacity] = useState(180);
  const [restDays, setRestDays] = useState<number[]>([]);

  const topics = filledTopics(rows);
  /* The server's window is 6 hours to 366 days (examWindowError). Tomorrow to a year keeps the
     picker inside it, so `exam_too_soon` cannot be reached by picking a date at all. */
  const minDate = addDayKey(today, 1);
  const maxDate = addDayKey(today, 365);
  /** Days of runway. `dayKeySpan` counts both ends, and the exam day itself is not study time. */
  const daysToExam = dayKeySpan(today, examAt) - 1;
  const labels = weekdayLabels(locale);
  const order = weekdayOrder(weekStartsOn);
  const strategyIsDedicated = strategy === "DEDICATED_DAYS";

  function appendTopics(incoming: ExamTopic[]) {
    setRows((current) => {
      const keep = current.filter((row) => row.title.trim().length >= 2);
      return [...keep, ...topicRows(incoming)].slice(0, MAX_TOPICS);
    });
  }

  function toggleRestDay(weekday: number) {
    setRestDays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : // Six is the cap: seven rest days leaves nowhere to put the plan.
          current.length >= 6
          ? current
          : [...current, weekday],
    );
  }

  async function generate() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/exam-plans/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          examAt,
          topics,
          questionStrategy: strategy,
          dailyCapacityMinutes: capacity,
          restDays,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (ExamPlanErrorPayload & { plan?: { id: string } })
        | null;
      if (!response.ok) {
        setMessage(examPlanErrorMessage(payload, ar));
        // Send the student back to the step that owns the first offending field.
        const culprit = examPlanErrorFields(payload)
          .map((field) => FIELD_STEP[field])
          .filter((value): value is number => Boolean(value))
          .sort((left, right) => left - right)[0];
        if (culprit) setStep(culprit);
        return;
      }
      if (payload?.plan?.id) router.push(`/exam-plans/${payload.plan.id}`);
    } catch {
      setMessage(examPlanOfflineMessage(ar));
    } finally {
      setPending(false);
    }
  }

  const NavArrow = ar ? ArrowLeft : ArrowRight;
  const BackArrow = ar ? ArrowRight : ArrowLeft;
  const nextButton = (target: number, disabled = false) => (
    <Button
      onClick={() => setStep(target)}
      disabled={disabled}
      rightIcon={ar ? undefined : <NavArrow className="w-4 h-4" />}
      leftIcon={ar ? <NavArrow className="w-4 h-4" /> : undefined}
    >
      {ar ? "التالي" : "Next"}
    </Button>
  );
  const backButton = (target: number) => (
    <Button
      variant="secondary"
      onClick={() => setStep(target)}
      leftIcon={ar ? undefined : <BackArrow className="w-4 h-4" />}
      rightIcon={ar ? <BackArrow className="w-4 h-4" /> : undefined}
    >
      {ar ? "رجوع" : "Back"}
    </Button>
  );

  return (
    <PageShell dir={ar ? "rtl" : "ltr"}>
      <PageHeader
        icon={Sparkles}
        eyebrow={ar ? "خطة امتحان AI" : "AI Exam Plan"}
        title={ar ? "ابدأ بمقترح قابل للتعديل." : "Start with an editable proposal."}
        description={
          ar
            ? "لن تتحول أي خطوة إلى مهمة قبل اختيارك وتأكيدك الصريح."
            : "No plan item becomes a task until you select it and explicitly confirm."
        }
        actions={
          <div className="page-header">
            <Link className="page-header-link" href="/insights">
              {ar ? "الرؤى" : "Insights"}
            </Link>
            <Link className="page-header-link" href="/tasks">
              {ar ? "المهام" : "Tasks"}
            </Link>
          </div>
        }
      />

      <div className="exam-plan-create-layout">
        <section className="exam-plan-form-panel" aria-labelledby="exam-plan-form-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                AI · {ar ? "مقترح فقط" : "proposal only"}
              </p>
              <h2 id="exam-plan-form-title">{ar ? "بيانات الامتحان" : "Exam details"}</h2>
            </div>
          </div>
          {aiEnabled ? (
            <div className="wizard-container">
              <div className="wizard-steps">
                {STEPS.map((index) => (
                  <Fragment key={index}>
                    {index > 1 && <div className="wizard-step-line" />}
                    <div
                      className={`wizard-step ${step >= index ? "active" : ""} ${
                        step > index ? "done" : ""
                      }`}
                    >
                      {index}
                    </div>
                  </Fragment>
                ))}
              </div>

              {step === 1 && (
                <div className="wizard-step-content">
                  <label className="ui-label">
                    {ar ? "عنوان الامتحان أو المقرر" : "Exam or course title"}
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      maxLength={120}
                      placeholder={
                        ar ? "مثال: امتحان الباطنة النهائي" : "e.g. Final Internal Medicine Exam"
                      }
                      className="ui-input"
                    />
                  </label>
                  {/* No margin here: `.wizard-step-content` is a flex column with its own gap, and
                      the inline `marginTop` that used to sit on this label doubled it. */}
                  <label className="ui-label">
                    {ar ? "تاريخ الامتحان (بتوقيت القاهرة)" : "Exam date (Cairo time)"}
                    <input
                      type="date"
                      value={examAt}
                      min={minDate}
                      max={maxDate}
                      onChange={(event) => setExamAt(event.target.value)}
                      className="ui-input"
                    />
                  </label>
                  {/* Same reason as the label above: the column already spaces its children, and
                      an extra margin pushed this hint further from the date than the date is from
                      the title, which reads as if it belongs to neither. */}
                  <p className="muted-copy">
                    {daysToExam < 1
                      ? ar
                        ? "اختر تاريخًا بعد اليوم."
                        : "Pick a date after today."
                      : daysToExam >= MAX_PLAN_DAYS
                        ? ar
                          ? `${daysToExam} يومًا حتى الامتحان. الخطة تغطي آخر ${MAX_PLAN_DAYS} يومًا.`
                          : `${daysToExam} days to the exam. The plan will cover the final ${MAX_PLAN_DAYS} days.`
                        : ar
                          ? `${daysToExam} يومًا من اليوم حتى الامتحان.`
                          : `${daysToExam} day${daysToExam === 1 ? "" : "s"} from today to the exam.`}
                  </p>
                  <div className="wizard-step-actions">
                    {nextButton(2, !title.trim() || examAt < minDate || examAt > maxDate)}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="wizard-step-content">
                  <p className="wizard-step-hint">
                    <ListChecks aria-hidden="true" className="w-4 h-4" />
                    {ar
                      ? "اكتب الموضوعات، أو صوّر فهرس الكتاب ودعنا نقرأه."
                      : "Write your topics, or photograph the book's index and let us read it."}
                  </p>
                  <SyllabusScanner
                    ar={ar}
                    topicCount={rows.length}
                    onTopics={appendTopics}
                    disabled={pending}
                  />
                  <TopicComposer ar={ar} rows={rows} onChange={setRows} disabled={pending} />
                  <div className="wizard-step-actions">
                    {backButton(1)}
                    {/* Exactly the server's rule: at least one topic with a real title. */}
                    {nextButton(3, topics.length < 1)}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="wizard-step-content">
                  <p className="wizard-step-hint">
                    <BookOpenCheck aria-hidden="true" className="w-4 h-4" />
                    {ar ? "كيف تريد حل الأسئلة؟" : "How do you want to solve questions?"}
                  </p>
                  <div className="exam-strategy-grid" role="radiogroup" aria-label={ar ? "نمط الأسئلة" : "Question rhythm"}>
                    <label className="exam-strategy-card" data-selected={strategyIsDedicated ? "yes" : undefined}>
                      <input
                        type="radio"
                        name="questionStrategy"
                        className="sr-only"
                        checked={strategyIsDedicated}
                        onChange={() => setStrategy("DEDICATED_DAYS")}
                      />
                      <strong>{ar ? "أيام مخصّصة للأسئلة" : "Dedicated question days"}</strong>
                      <span>
                        {ar
                          ? "أيام كاملة بلا مادة جديدة، لبنوك الأسئلة والامتحانات السابقة."
                          : "Whole days with no new material, for question banks and past papers."}
                      </span>
                    </label>
                    <label className="exam-strategy-card" data-selected={strategyIsDedicated ? undefined : "yes"}>
                      <input
                        type="radio"
                        name="questionStrategy"
                        className="sr-only"
                        checked={!strategyIsDedicated}
                        onChange={() => setStrategy("INTEGRATED")}
                      />
                      <strong>{ar ? "أسئلة كل يوم" : "Questions every day"}</strong>
                      <span>
                        {ar
                          ? "كل يوم دراسة ينتهي بأسئلة على ما دُرس فيه."
                          : "Every study day ends with questions on what it covered."}
                      </span>
                    </label>
                  </div>

                  {/* The readout belongs on the same line as the label, opposite it -- inline it
                      simply abutted the text and read as "Study time per day3h". */}
                  <label className="ui-label exam-capacity-label">
                    {ar ? "وقت الدراسة في اليوم" : "Study time per day"}
                    <span className="exam-capacity-readout">{formatLoad(capacity, ar)}</span>
                    <input
                      type="range"
                      min={30}
                      max={600}
                      step={15}
                      value={capacity}
                      className="exam-capacity-range"
                      onChange={(event) => setCapacity(Number(event.target.value))}
                    />
                  </label>

                  <fieldset className="exam-rest-days">
                    <legend>{ar ? "أيام الراحة (اختياري)" : "Rest days (optional)"}</legend>
                    <div className="exam-rest-day-row">
                      {order.map((weekday) => {
                        const chosen = restDays.includes(weekday);
                        return (
                          <label
                            key={weekday}
                            className="exam-rest-day"
                            data-selected={chosen ? "yes" : undefined}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={chosen}
                              onChange={() => toggleRestDay(weekday)}
                            />
                            {labels[weekday]}
                          </label>
                        );
                      })}
                    </div>
                    <p className="muted-copy">
                      {ar
                        ? "لن نضع شيئًا في هذه الأيام، إلا إذا لم يتبقَّ وقت."
                        : "Nothing gets scheduled on these days unless there is no room left."}
                    </p>
                  </fieldset>

                  <div className="wizard-step-actions">
                    {backButton(2)}
                    {nextButton(4)}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="wizard-step-content">
                  <div className="exam-review-card">
                    <h3>
                      <CalendarClock aria-hidden="true" className="w-4 h-4" />
                      {ar ? "قبل التوليد" : "Before we generate"}
                    </h3>
                    <dl className="exam-review-list">
                      <div>
                        <dt>{ar ? "المادة" : "Course"}</dt>
                        <dd>{title}</dd>
                      </div>
                      <div>
                        <dt>{ar ? "الموعد" : "Exam"}</dt>
                        <dd>
                          {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                            dateStyle: "full",
                            timeZone: "UTC",
                          }).format(new Date(`${examAt}T12:00:00Z`))}
                        </dd>
                      </div>
                      <div>
                        <dt>{ar ? "الموضوعات" : "Topics"}</dt>
                        <dd>
                          {ar
                            ? `${topics.length} موضوعًا`
                            : `${topics.length} topic${topics.length === 1 ? "" : "s"}`}
                        </dd>
                      </div>
                      <div>
                        <dt>{ar ? "الأسئلة" : "Questions"}</dt>
                        <dd>
                          {strategyIsDedicated
                            ? ar
                              ? "أيام مخصّصة"
                              : "Dedicated days"
                            : ar
                              ? "كل يوم"
                              : "Every day"}
                        </dd>
                      </div>
                      <div>
                        <dt>{ar ? "اليوم" : "Daily"}</dt>
                        <dd>{formatLoad(capacity, ar)}</dd>
                      </div>
                      <div>
                        <dt>{ar ? "الراحة" : "Rest"}</dt>
                        <dd>
                          {restDays.length
                            ? restDays
                                .slice()
                                .sort((left, right) => order.indexOf(left) - order.indexOf(right))
                                .map((weekday) => labels[weekday])
                                .join(ar ? "، " : ", ")
                            : ar
                              ? "بلا أيام راحة"
                              : "None"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {message && (
                    <p className="form-error" role="alert">
                      {message}
                    </p>
                  )}

                  <div className="wizard-step-actions">
                    {backButton(3)}
                    <Button
                      variant="primary"
                      size="md"
                      isLoading={pending}
                      disabled={topics.length < 1}
                      leftIcon={<Sparkles className="w-4 h-4" />}
                      onClick={generate}
                    >
                      {ar ? "توليد مقترح الخطة" : "Generate plan proposal"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="quiet-state">
              <p>
                {ar
                  ? "مساعد الذكاء الاصطناعي معطّل في إعدادات الخصوصية. فعّله لتوليد خطط امتحانات مخصصة."
                  : "AI features are disabled in your privacy settings. Enable them to generate study plans."}
              </p>
              <Button href="/settings" variant="secondary" size="sm">
                {ar ? "الإعدادات" : "Settings"}
              </Button>
            </div>
          )}
        </section>

        <aside className="exam-plan-recent-panel">
          <div className="section-heading">
            <h2>{ar ? "الخطط السابقة" : "Recent plans"}</h2>
          </div>
          {recentPlans.length ? (
            <div className="exam-plan-list">
              {recentPlans.map((plan) => (
                <Link key={plan.id} href={`/exam-plans/${plan.id}`} className="exam-plan-card">
                  <div>
                    <strong>{plan.title}</strong>
                    <time>
                      {new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", {
                        dateStyle: "medium",
                        timeZone: "Africa/Cairo",
                      }).format(new Date(plan.examAt))}
                    </time>
                  </div>
                  <NavArrow className="w-4 h-4 text-muted" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted-copy">{ar ? "لا توجد خطط سابقة." : "No previous plans."}</p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
