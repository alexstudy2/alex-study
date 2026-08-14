"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Challenge, ChallengeEvent } from "@/components/challenges/types";
import {
  challengeTypeLabel,
  challengeUnit,
  formatDate,
  resolutionLabel,
  statusLabel,
} from "@/components/challenges/format";

export function ChallengeDetail({
  userId,
  locale,
  initialChallenge,
  initialEvents,
  serverNow,
}: {
  userId: string;
  locale: "en" | "ar";
  initialChallenge: Challenge;
  initialEvents: ChallengeEvent[];
  serverNow: string;
}) {
  const ar = locale === "ar";
  const [challenge, setChallenge] = useState(initialChallenge);
  const [events, setEvents] = useState(initialEvents);
  const [offset, setOffset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const terminal = ["COMPLETED", "EXPIRED", "DECLINED", "CANCELLED"].includes(challenge.status);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refreshChallenge = useCallback(
    async (withEvents = true) => {
      const response = await fetch(`/api/challenges/${challenge.id}`, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        setChallenge(payload.challenge);
        setOffset(new Date(payload.serverNow).getTime() - Date.now());
      }
      if (withEvents) {
        const eventResponse = await fetch(`/api/challenges/${challenge.id}/events`, {
          cache: "no-store",
        });
        if (eventResponse.ok) setEvents((await eventResponse.json()).events);
      }
    },
    [challenge.id],
  );

  useEffect(() => {
    if (terminal) return;
    const poll = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      await refreshChallenge();
    }, 12000);
    return () => window.clearInterval(poll);
  }, [refreshChallenge, terminal]);

  async function act(action: "accept" | "decline" | "cancel") {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/challenges/${challenge.id}/${action}`, { method: "POST" });
    if (response.ok) {
      await refreshChallenge();
      setMessage(
        action === "accept"
          ? ar
            ? "تم قبول التحدي. بدأ احتساب النشاط المؤهل."
            : "Challenge accepted. Eligible activity is now being counted."
          : ar
            ? "تم تحديث التحدي."
            : "Challenge updated.",
      );
    } else {
      setMessage(ar ? "تعذر إكمال الإجراء." : "That action could not be completed.");
    }
    setBusy(false);
  }

  const countdown = useMemo(() => {
    const current = now + offset;
    const target =
      challenge.status === "SCHEDULED"
        ? new Date(challenge.startsAt).getTime()
        : new Date(challenge.endsAt).getTime();
    return Math.max(0, target - current);
  }, [challenge.endsAt, challenge.startsAt, challenge.status, now, offset]);
  const creatorPending = challenge.status === "PENDING" && challenge.creatorId === userId;
  const opponentPending = challenge.status === "PENDING" && challenge.opponentId === userId;

  return (
    <main className="challenge-detail-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="challenge-detail-header">
        <div>
          <Link className="wordmark" href="/challenges">
            Alex Study
          </Link>
          <p className="eyebrow">{challengeTypeLabel(challenge.type, locale)}</p>
          <h1>
            {challenge.creator.name} <span>{ar ? "ضد" : "vs"}</span> {challenge.opponent.name}
          </h1>
          <p>
            {challenge.subjectLabel ? `${challenge.subjectLabel} · ` : ""}
            {challenge.targetValue} {challengeUnit(challenge.type, challenge.targetValue, locale)} ·{" "}
            {resolutionLabel(challenge.resolutionType, locale)}
          </p>
        </div>
        <div className="page-header">
          <span className="challenge-status" data-status={challenge.status}>
            {statusLabel(challenge.status, locale)}
          </span>
          <Link className="secondary-button" href="/challenges">
            {ar ? "كل التحديات" : "All challenges"}
          </Link>
        </div>
      </header>

      {message && (
        <p className="challenge-feedback" role="status" aria-live="polite">
          {message}
        </p>
      )}

      {opponentPending && (
        <section className="challenge-invite-band">
          <div>
            <p className="eyebrow">{ar ? "دعوة جديدة" : "New invitation"}</p>
            <h2>{ar ? "راجع القواعد قبل القبول." : "Review the rules before accepting."}</h2>
            <p>
              {ar
                ? "لن يُحتسب أي نشاط قبل قبولك، ويمكن لكليكما إلغاء التحدي لاحقًا."
                : "Nothing counts before you accept, and either person can cancel later."}
            </p>
          </div>
          <div className="inline-actions">
            <button className="secondary-button" disabled={busy} onClick={() => act("decline")}>
              {ar ? "رفض" : "Decline"}
            </button>
            <button className="primary-button" disabled={busy} onClick={() => act("accept")}>
              {busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : ar ? "قبول التحدي" : "Accept challenge"}
            </button>
          </div>
        </section>
      )}

      {creatorPending && (
        <section className="challenge-invite-band">
          <div>
            <p className="eyebrow">{ar ? "بانتظار الرد" : "Awaiting response"}</p>
            <h2>
              {ar
                ? `أُرسلت الدعوة إلى ${challenge.opponent.name}.`
                : `Invitation sent to ${challenge.opponent.name}.`}
            </h2>
            <p>
              {ar ? "لن يبدأ الاحتساب قبل القبول." : "Tracking does not begin until they accept."}
            </p>
          </div>
          <button className="danger-button" disabled={busy} onClick={() => act("cancel")}>
            {ar ? "إلغاء الدعوة" : "Cancel invitation"}
          </button>
        </section>
      )}

      <section
        className="challenge-scoreboard"
        aria-label={ar ? "لوحة تقدم التحدي" : "Challenge progress"}
      >
        {challenge.progress.map((progress) => {
          const percentage = Math.min(
            100,
            Math.round((progress.currentValue / challenge.targetValue) * 100),
          );
          return (
            <article key={progress.id} data-self={progress.userId === userId}>
              <div className="scoreboard-person">
                <span aria-hidden="true">{progress.user.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{progress.user.name}</strong>
                  <small>
                    {progress.userId === userId
                      ? ar
                        ? "أنت"
                        : "You"
                      : ar
                        ? `السنة ${progress.user.academicYear}`
                        : `Year ${progress.user.academicYear}`}
                  </small>
                </div>
              </div>
              <div className="scoreboard-value">
                <strong>{progress.currentValue}</strong>
                <span>/ {challenge.targetValue}</span>
              </div>
              <div
                className="challenge-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={challenge.targetValue}
                aria-valuenow={progress.currentValue}
                aria-label={`${progress.user.name}: ${progress.currentValue} / ${challenge.targetValue}`}
              >
                <span style={{ width: `${percentage}%` }} />
              </div>
              <p>
                {percentage}% · {challengeUnit(challenge.type, progress.currentValue, locale)}
              </p>
            </article>
          );
        })}
      </section>

      <section className="challenge-time-band">
        <div>
          <p className="eyebrow">
            {challenge.status === "SCHEDULED"
              ? ar
                ? "يبدأ خلال"
                : "Starts in"
              : ar
                ? "الوقت المتبقي"
                : "Time remaining"}
          </p>
          <output aria-live="off" aria-label={ar ? "العد التنازلي" : "Countdown"}>
            {terminal || challenge.status === "PENDING"
              ? "--:--:--"
              : formatCountdown(countdown, ar)}
          </output>
        </div>
        <dl>
          <div>
            <dt>{ar ? "البداية" : "Starts"}</dt>
            <dd>{formatDate(challenge.startsAt, locale)}</dd>
          </div>
          <div>
            <dt>{ar ? "النهاية" : "Ends"}</dt>
            <dd>{formatDate(challenge.endsAt, locale)}</dd>
          </div>
          <div>
            <dt>{ar ? "طريقة الحسم" : "Resolution"}</dt>
            <dd>{resolutionLabel(challenge.resolutionType, locale)}</dd>
          </div>
        </dl>
      </section>

      <div className="challenge-detail-grid">
        <section className="challenge-event-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ar ? "سجل قابل للمراجعة" : "Auditable log"}</p>
              <h2>{ar ? "أحداث التقدم" : "Progress events"}</h2>
            </div>
            <button className="text-button" onClick={() => refreshChallenge()}>
              {ar ? "تحديث" : "Refresh"}
            </button>
          </div>
          <ol className="challenge-event-list">
            {events.length ? (
              events.map((event) => (
                <li key={event.id} data-adjustment={event.eventType === "ADJUSTMENT"}>
                  <span className="event-mark" aria-hidden="true" />
                  <div>
                    <strong>
                      {event.progress.user.name} · {event.deltaValue > 0 ? "+" : ""}
                      {event.deltaValue}
                    </strong>
                    <p>
                      {event.eventType === "ADJUSTMENT"
                        ? ar
                          ? "تسوية بعد تعديل أو حذف المصدر"
                          : "Adjustment after a source changed or was removed"
                        : event.sourceType === "TASK"
                          ? ar
                            ? "مهمة مؤهلة"
                            : "Eligible task"
                          : ar
                            ? "جلسة مؤقت مؤهلة"
                            : "Eligible timer session"}
                    </p>
                    <time>{formatDate(event.occurredAt, locale)}</time>
                  </div>
                </li>
              ))
            ) : (
              <li className="challenge-event-empty">
                {ar ? "لم يُسجل نشاط مؤهل بعد." : "No eligible activity has been recorded yet."}
              </li>
            )}
          </ol>
        </section>

        <aside className="challenge-rule-panel">
          <p className="eyebrow">{ar ? "قواعد هذا التحدي" : "This challenge"}</p>
          <h2>{ar ? "احتساب واضح" : "Clear counting"}</h2>
          <dl>
            <div>
              <dt>{ar ? "المقياس" : "Measure"}</dt>
              <dd>{challengeTypeLabel(challenge.type, locale)}</dd>
            </div>
            <div>
              <dt>{ar ? "النطاق" : "Scope"}</dt>
              <dd>{challenge.subjectLabel ?? (ar ? "كل المواد" : "All subjects")}</dd>
            </div>
            <div>
              <dt>{ar ? "الحد الأدنى للمهمة" : "Task minimum"}</dt>
              <dd>{ar ? "10 دقائق" : "10 minutes"}</dd>
            </div>
            <div>
              <dt>{ar ? "الجلسات اليدوية" : "Manual sessions"}</dt>
              <dd>{ar ? "غير محتسبة" : "Excluded"}</dd>
            </div>
          </dl>
          {!terminal && !creatorPending && !opponentPending && (
            <button className="danger-button" disabled={busy} onClick={() => act("cancel")}>
              {ar ? "إلغاء التحدي" : "Cancel challenge"}
            </button>
          )}
          {terminal && (
            <Link className="primary-button" href={`/challenges/${challenge.id}/result`}>
              {ar ? "عرض النتيجة" : "View result"}
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}

function formatCountdown(milliseconds: number, ar: boolean) {
  const total = Math.floor(milliseconds / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const clock = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return days ? `${days}${ar ? "ي" : "d"} ${clock}` : clock;
}
