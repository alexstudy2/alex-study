"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Person = { id: string; name: string; academicYear: number };
type Subject = { id: string; name: string; normalizedName: string };

function localInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ChallengeCreateForm({
  locale,
  friends,
  subjects,
}: {
  locale: "en" | "ar";
  friends: Person[];
  subjects: Subject[];
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const initialStart = useMemo(() => new Date(), []);
  const [opponentId, setOpponentId] = useState(friends[0]?.id ?? "");
  const [type, setType] = useState("TASK_COUNT");
  const [resolutionType, setResolutionType] = useState("TARGET_FIRST");
  const [targetValue, setTargetValue] = useState(5);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(localInput(initialStart));
  const [endsAt, setEndsAt] = useState(localInput(new Date(initialStart.getTime() + 7 * 86400000)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const subjectType = type.startsWith("SUBJECT_");
  const taskType = type.includes("TASK_COUNT");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        opponentId,
        type,
        resolutionType,
        targetValue,
        subjectId: subjectType ? subjectId : null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      router.push(`/challenges/${payload.challenge.id}`);
      return;
    }
    const code = payload?.fields?.challenge?.[0];
    setMessage(
      code === "active_pair_challenge"
        ? ar
          ? "يوجد بالفعل تحدٍ مفتوح بينكما."
          : "You already have an open challenge with this friend."
        : code === "invalid_subject"
          ? ar
            ? "اختر مادة نشطة لهذا التحدي."
            : "Choose an active subject for this challenge."
          : ar
            ? "راجع التفاصيل وحاول مرة أخرى."
            : "Review the details and try again.",
    );
    setBusy(false);
  }

  return (
    <main className="challenge-form-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="challenge-form-header">
        <div className="page-header-text">
          <Link className="wordmark" href="/challenges">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "منشئ التحدي" : "Challenge composer"}</p>
          <h1>{ar ? "اتفقا على هدف واضح." : "Agree on a goal that is easy to audit."}</h1>
          <p>
            {ar
              ? "سيرى صديقك الهدف، وقواعد الأهلية، وطريقة الحسم، والمدة قبل القبول."
              : "Your friend sees the target, eligibility rules, resolution mode, and duration before accepting."}
          </p>
        </div>
        <Link className="secondary-button" href="/challenges">
          {ar ? "إلغاء" : "Cancel"}
        </Link>
      </header>

      {friends.length ? (
        <form className="challenge-composer" onSubmit={submit}>
          <section>
            <div className="composer-step">
              <span>01</span>
              <div>
                <p className="eyebrow">{ar ? "الصديق" : "Opponent"}</p>
                <h2>{ar ? "من يشاركك التحدي؟" : "Who is joining you?"}</h2>
              </div>
            </div>
            <div
              className="opponent-picker"
              role="radiogroup"
              aria-label={ar ? "اختر صديقًا" : "Choose a friend"}
            >
              {friends.map((friend) => (
                <label key={friend.id}>
                  <input
                    type="radio"
                    name="opponent"
                    value={friend.id}
                    checked={opponentId === friend.id}
                    onChange={() => setOpponentId(friend.id)}
                  />
                  <span aria-hidden="true">{friend.name.slice(0, 1).toUpperCase()}</span>
                  <strong>{friend.name}</strong>
                  <small>
                    {ar ? `السنة ${friend.academicYear}` : `Year ${friend.academicYear}`}
                  </small>
                </label>
              ))}
            </div>
          </section>

          <section>
            <div className="composer-step">
              <span>02</span>
              <div>
                <p className="eyebrow">{ar ? "المقياس" : "Measure"}</p>
                <h2>{ar ? "ماذا تريد أن تبني؟" : "What are you trying to build?"}</h2>
              </div>
            </div>
            <div className="challenge-choice-grid">
              {[
                [
                  "TASK_COUNT",
                  ar ? "المهام" : "Tasks",
                  ar ? "مهام مؤهلة في كل المواد" : "Eligible tasks across all subjects",
                ],
                [
                  "STUDY_TIME",
                  ar ? "وقت الدراسة" : "Study time",
                  ar ? "دقائق من جلسات المؤقت" : "Minutes from timer-based sessions",
                ],
                [
                  "SUBJECT_TASK_COUNT",
                  ar ? "مهام مادة" : "Subject tasks",
                  ar ? "مهام مؤهلة لمادة واحدة" : "Eligible tasks for one subject",
                ],
                [
                  "SUBJECT_STUDY_TIME",
                  ar ? "وقت مادة" : "Subject time",
                  ar ? "دقائق دراسة لمادة واحدة" : "Study minutes for one subject",
                ],
              ].map(([value, label, help]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => {
                      setType(value);
                      setTargetValue(value.includes("TASK_COUNT") ? 5 : 120);
                    }}
                  />
                  <strong>{label}</strong>
                  <small>{help}</small>
                </label>
              ))}
            </div>
            {subjectType && (
              <label className="composer-field">
                <span>{ar ? "المادة" : "Subject"}</span>
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  required
                >
                  {subjects.map((subject) => (
                    <option value={subject.id} key={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {!subjects.length && (
                  <small className="form-error">
                    {ar ? "أنشئ مادة أولًا من صفحة المهام." : "Create a subject from Tasks first."}
                  </small>
                )}
              </label>
            )}
          </section>

          <section className="composer-split">
            <div>
              <div className="composer-step">
                <span>03</span>
                <div>
                  <p className="eyebrow">{ar ? "الهدف" : "Target"}</p>
                  <h2>{ar ? "كم تريد أن تنجز؟" : "How much will you aim for?"}</h2>
                </div>
              </div>
              <label className="composer-field target-field">
                <span>
                  {taskType
                    ? ar
                      ? "عدد المهام"
                      : "Eligible tasks"
                    : ar
                      ? "الدقائق"
                      : "Eligible minutes"}
                </span>
                <input
                  type="number"
                  min={taskType ? 1 : 10}
                  max={taskType ? 100 : 20000}
                  value={targetValue}
                  onChange={(event) => setTargetValue(Number(event.target.value))}
                  required
                />
              </label>
            </div>
            <div>
              <div className="composer-step">
                <span>04</span>
                <div>
                  <p className="eyebrow">{ar ? "الحسم" : "Resolution"}</p>
                  <h2>{ar ? "كيف تُحسم النتيجة؟" : "How should it be decided?"}</h2>
                </div>
              </div>
              <div className="resolution-picker">
                <label>
                  <input
                    type="radio"
                    name="resolution"
                    checked={resolutionType === "TARGET_FIRST"}
                    onChange={() => setResolutionType("TARGET_FIRST")}
                  />
                  <span>
                    <strong>{ar ? "الأول إلى الهدف" : "First to target"}</strong>
                    <small>
                      {ar
                        ? "ينتهي عند وصول أول شخص للهدف."
                        : "Ends when the first person reaches the target."}
                    </small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="resolution"
                    checked={resolutionType === "DEADLINE_LEADER"}
                    onChange={() => setResolutionType("DEADLINE_LEADER")}
                  />
                  <span>
                    <strong>{ar ? "المتصدر عند الموعد" : "Leader at deadline"}</strong>
                    <small>
                      {ar
                        ? "يُحسم عند نهاية المدة، والتعادل ممكن."
                        : "Resolves at the deadline; a draw is possible."}
                    </small>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className="composer-step">
              <span>05</span>
              <div>
                <p className="eyebrow">{ar ? "المدة" : "Schedule"}</p>
                <h2>{ar ? "متى يبدأ وينتهي؟" : "When does it run?"}</h2>
              </div>
            </div>
            <div className="composer-date-grid">
              <label className="composer-field">
                <span>{ar ? "البداية" : "Starts"}</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                />
              </label>
              <label className="composer-field">
                <span>{ar ? "النهاية" : "Ends"}</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  required
                />
              </label>
            </div>
          </section>

          <aside className="composer-rules">
            <strong>{ar ? "قبل الإرسال" : "Before you send"}</strong>
            <p>
              {ar
                ? "المهام القصيرة والجلسات اليدوية لا تُحتسب. إذا عُدّل مصدر أو حُذف، تُعاد النتيجة تلقائيًا مع حدث تسوية ظاهر."
                : "Short tasks and manual sessions do not count. If a source is edited or deleted, the result is recalculated with a visible adjustment event."}
            </p>
          </aside>

          {message && (
            <p className="form-error" role="alert">
              {message}
            </p>
          )}
          <div className="composer-actions">
            <Link className="secondary-button" href="/challenges">
              {ar ? "رجوع" : "Back"}
            </Link>
            <button className="primary-button" disabled={busy || (subjectType && !subjectId)}>
              {busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال الدعوة" : "Send invitation"}
            </button>
          </div>
        </form>
      ) : (
        <section className="challenge-empty challenge-form-empty">
          <h2>{ar ? "أضف صديقًا أولًا." : "Add a friend first."}</h2>
          <p>
            {ar
              ? "التحديات الفردية متاحة بين الأصدقاء المقبولين فقط."
              : "One-to-one challenges are available only between accepted friends."}
          </p>
          <Link className="primary-button" href="/friends">
            {ar ? "فتح الأصدقاء" : "Open friends"}
          </Link>
        </section>
      )}
    </main>
  );
}
