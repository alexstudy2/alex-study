"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Challenge } from "@/components/challenges/types";
import {
  badgeCopy,
  challengeTypeLabel,
  challengeUnit,
  formatDate,
  resolutionLabel,
  statusLabel,
} from "@/components/challenges/format";

export function ChallengeResult({
  userId,
  locale,
  initialChallenge,
  initialShareFullName,
  initialPublicNames,
}: {
  userId: string;
  locale: "en" | "ar";
  initialChallenge: Challenge;
  initialShareFullName: boolean;
  initialPublicNames: Record<string, string>;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [challenge, setChallenge] = useState(initialChallenge);
  const [shareFullName, setShareFullName] = useState(initialShareFullName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const winner = challenge.winnerId
    ? (challenge.progress.find((progress) => progress.userId === challenge.winnerId)?.user ?? null)
    : null;
  const acceptedTerminal =
    Boolean(challenge.acceptedAt) && ["COMPLETED", "EXPIRED"].includes(challenge.status);

  async function share(enabled: boolean) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/challenges/${challenge.id}/share-token/rotate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (response.ok) {
      const payload = await response.json();
      setChallenge({
        ...challenge,
        shareEnabled: payload.shareEnabled,
        shareToken: payload.shareToken,
      });
      setMessage(
        enabled
          ? ar
            ? "أصبح رابط النتيجة جاهزًا."
            : "A fresh result link is ready."
          : ar
            ? "تم إيقاف الرابط العام."
            : "Public sharing is off.",
      );
    } else {
      setMessage(ar ? "تعذر تحديث المشاركة." : "Sharing could not be updated.");
    }
    setBusy(false);
  }

  async function toggleFullName() {
    const next = !shareFullName;
    setShareFullName(next);
    const response = await fetch("/api/me/privacy", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shareFullNameOnCards: next }),
    });
    if (!response.ok) setShareFullName(!next);
  }

  async function copyLink() {
    const url = `${window.location.origin}/share/challenges/${challenge.shareToken}`;
    await navigator.clipboard.writeText(url);
    setMessage(ar ? "تم نسخ الرابط." : "Link copied.");
  }

  async function rematch() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/challenges/${challenge.id}/rematch`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      router.push(`/challenges/${payload.challenge.id}`);
      return;
    }
    const code = payload?.fields?.challenge?.[0];
    setMessage(
      code === "active_pair_challenge"
        ? ar
          ? "يوجد تحدٍ مفتوح بينكما بالفعل."
          : "You already have an open challenge together."
        : ar
          ? "تعذر إنشاء الإعادة."
          : "The rematch could not be created.",
    );
    setBusy(false);
  }

  return (
    <main className="challenge-result-shell" dir={ar ? "rtl" : "ltr"}>
      <header className="result-header">
        <div>
          <Link className="wordmark" href="/challenges">
            Alex Study
          </Link>
          <p className="eyebrow">{ar ? "نتيجة التحدي" : "Challenge result"}</p>
          <h1>{resultHeading(challenge, winner?.id ?? null, userId, locale)}</h1>
          <p>{resultSummary(challenge, winner?.name ?? null, locale)}</p>
        </div>
        <nav
          className="challenge-header-actions"
          aria-label={ar ? "إجراءات النتيجة" : "Result actions"}
        >
          <Link className="secondary-button" href={`/challenges/${challenge.id}`}>
            {ar ? "سجل التقدم" : "Progress log"}
          </Link>
          <button className="primary-button" disabled={busy} onClick={rematch}>
            {ar ? "إعادة التحدي" : "Rematch"}
          </button>
        </nav>
      </header>

      {message && (
        <p className="challenge-feedback" role="status" aria-live="polite">
          {message}
        </p>
      )}

      <section className="result-score-band">
        <div className="result-outcome">
          <span className="challenge-status" data-status={challenge.status}>
            {statusLabel(challenge.status, locale)}
          </span>
          <p>{challengeTypeLabel(challenge.type, locale)}</p>
          <strong>{challenge.subjectLabel ?? (ar ? "كل المواد" : "All subjects")}</strong>
          <small>
            {resolutionLabel(challenge.resolutionType, locale)} ·{" "}
            {formatDate(challenge.endsAt, locale)}
          </small>
        </div>
        <div className="result-participants">
          {challenge.progress.map((progress) => {
            const value = progress.finalValue ?? progress.currentValue;
            const leading = challenge.winnerId === progress.userId;
            return (
              <article key={progress.id} data-leading={leading}>
                <span>
                  {leading
                    ? ar
                      ? "النتيجة المتقدمة"
                      : "Leading result"
                    : progress.userId === userId
                      ? ar
                        ? "نتيجتك"
                        : "Your result"
                      : ar
                        ? "النتيجة"
                        : "Result"}
                </span>
                <h2>{progress.user.name}</h2>
                <div>
                  <strong>{value}</strong>
                  <small>{challengeUnit(challenge.type, value, locale)}</small>
                </div>
                <p>
                  {progress.targetReachedAt
                    ? ar
                      ? "وصل إلى الهدف"
                      : "Reached the target"
                    : ar
                      ? "لم يصل إلى الهدف"
                      : "Target not reached"}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <div className="result-layout">
        <section className="result-share-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{ar ? "بطاقة عامة" : "Public result card"}</p>
              <h2>
                {ar
                  ? "شارك النتيجة دون بيانات جامعية."
                  : "Share the result without college identifiers."}
              </h2>
            </div>
          </div>
          <div
            className="share-card-preview"
            aria-label={ar ? "معاينة بطاقة المشاركة" : "Share card preview"}
          >
            <header>
              <span>Alex Study</span>
              <strong>{challengeTypeLabel(challenge.type, locale)}</strong>
            </header>
            <p>{challenge.subjectLabel ?? (ar ? "تحدي دراسة" : "Study challenge")}</p>
            <div>
              {challenge.progress.map((progress) => (
                <article key={progress.id}>
                  <span>
                    {progress.userId === userId
                      ? publicPreviewName(progress.user.name, shareFullName)
                      : (initialPublicNames[progress.userId] ??
                        publicPreviewName(progress.user.name, false))}
                  </span>
                  <strong>{progress.finalValue ?? progress.currentValue}</strong>
                  <small>
                    {ar
                      ? `السنة ${progress.user.academicYear}`
                      : `Year ${progress.user.academicYear}`}
                  </small>
                </article>
              ))}
            </div>
            <footer>
              {statusLabel(challenge.status, locale)} ·{" "}
              {resolutionLabel(challenge.resolutionType, locale)}
            </footer>
          </div>
          <div className="share-controls">
            <label>
              <input type="checkbox" checked={shareFullName} onChange={toggleFullName} />
              <span>
                {ar ? "إظهار الاسم الكامل في بطاقاتي العامة" : "Show my full name on public cards"}
              </span>
            </label>
            <p className="muted-copy">
              {ar
                ? "الافتراضي هو الاسم الأول والسنة الدراسية فقط. لا يظهر الرقم الجامعي أبدًا."
                : "The default is first name plus academic year. College IDs are never included."}
            </p>
            <div className="inline-actions">
              {challenge.shareEnabled ? (
                <>
                  <button className="primary-button" onClick={copyLink}>
                    {ar ? "نسخ الرابط" : "Copy link"}
                  </button>
                  <a
                    className="secondary-button"
                    href={`/share/challenges/${challenge.shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ar ? "معاينة" : "Preview"}
                  </a>
                  <button className="text-button" disabled={busy} onClick={() => share(false)}>
                    {ar ? "إيقاف المشاركة" : "Turn off"}
                  </button>
                </>
              ) : (
                <button
                  className="primary-button"
                  disabled={busy || !acceptedTerminal}
                  onClick={() => share(true)}
                >
                  {ar ? "إنشاء رابط عام" : "Create public link"}
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="result-badge-panel">
          <p className="eyebrow">{ar ? "ما تم اكتسابه" : "What was earned"}</p>
          <h2>{ar ? "شارات هذا التحدي" : "Challenge badges"}</h2>
          <div className="result-badges">
            {challenge.badgeAwards.length ? (
              challenge.badgeAwards.map((award) => (
                <article key={award.id}>
                  <span aria-hidden="true">{badgeIcon(award.badge.iconKey)}</span>
                  <div>
                    <strong>{badgeCopy(award.badge.key, locale, award.badge).name}</strong>
                    <p>{award.user.name}</p>
                    <small>{badgeCopy(award.badge.key, locale, award.badge).description}</small>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted-copy">
                {ar ? "لم تُمنح شارات لهذه النتيجة." : "No badges were awarded for this result."}
              </p>
            )}
          </div>
          <div className="result-note">
            <strong>{ar ? "التصحيحات تظل سارية" : "Corrections remain active"}</strong>
            <p>
              {ar
                ? "إذا تغير مصدر مؤهل لاحقًا، قد تتغير النتيجة والشارات تلقائيًا."
                : "If an eligible source changes later, the result and badges can be revised automatically."}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function publicPreviewName(name: string, full: boolean) {
  return full ? name : name.trim().split(/\s+/)[0] || "Student";
}

function badgeIcon(icon: string) {
  return icon === "medal" ? "◎" : icon === "target" ? "⌖" : icon === "trend-up" ? "↗" : "⚑";
}

function resultHeading(
  challenge: Challenge,
  winnerId: string | null,
  userId: string,
  locale: "en" | "ar",
) {
  if (challenge.status === "EXPIRED")
    return locale === "ar" ? "أُغلق الهدف دون فائز." : "The target window closed without a winner.";
  if (["DECLINED", "CANCELLED"].includes(challenge.status))
    return locale === "ar" ? "أُغلق التحدي دون نتيجة." : "Challenge closed without a result.";
  if (!winnerId) return locale === "ar" ? "نتيجة متعادلة." : "A level finish.";
  if (winnerId === userId)
    return locale === "ar"
      ? "أنهيت التحدي بالنتيجة المتقدمة."
      : "You finished with the leading result.";
  return locale === "ar" ? "اكتمل التحدي." : "Challenge complete.";
}

function resultSummary(challenge: Challenge, winnerName: string | null, locale: "en" | "ar") {
  if (challenge.status === "EXPIRED")
    return locale === "ar"
      ? "انتهت المدة قبل أن يصل أي طرف إلى الهدف."
      : "The window ended before either student reached the target.";
  if (["DECLINED", "CANCELLED"].includes(challenge.status))
    return locale === "ar" ? "لم تُسجل نتيجة تنافسية." : "No competitive result was recorded.";
  if (!winnerName)
    return locale === "ar"
      ? "انتهى الطرفان على نفس النتيجة المؤهلة، أو لم يصل أحد للهدف."
      : "Both students finished level, or the target closed without a winner.";
  return locale === "ar"
    ? `${winnerName} أنهى التحدي بالنتيجة المتقدمة المؤهلة.`
    : `${winnerName} finished with the leading eligible result.`;
}
