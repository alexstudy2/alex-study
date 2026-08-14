import type { publicChallengeByToken } from "@/lib/challenges/service";
import {
  challengeTypeLabel,
  challengeUnit,
  resolutionLabel,
  statusLabel,
} from "@/components/challenges/format";

type PublicChallenge = NonNullable<Awaited<ReturnType<typeof publicChallengeByToken>>>;

export function PublicChallengeCard({
  challenge,
  locale,
}: {
  challenge: PublicChallenge;
  locale: "en" | "ar";
}) {
  const ar = locale === "ar";
  const maxValue = Math.max(
    challenge.targetValue,
    ...challenge.participants.map((participant) => participant.value),
  );
  return (
    <main className="public-challenge-shell" dir={ar ? "rtl" : "ltr"}>
      <article className="public-challenge-card">
        <header>
          <div>
            <span className="wordmark">Alex Study</span>
            <p className="eyebrow">{ar ? "نتيجة تحدٍ مشتركة" : "Shared challenge result"}</p>
          </div>
          <span className="challenge-status" data-status={challenge.status}>
            {statusLabel(challenge.status, locale)}
          </span>
        </header>
        <section className="public-card-title">
          <p>{challengeTypeLabel(challenge.type, locale)}</p>
          <h1>{challenge.subjectLabel ?? (ar ? "تحدي دراسة" : "Study challenge")}</h1>
          <span>
            {challenge.targetValue} {challengeUnit(challenge.type, challenge.targetValue, locale)} ·{" "}
            {resolutionLabel(challenge.resolutionType, locale)}
          </span>
        </section>
        <section
          className="public-card-scores"
          aria-label={ar ? "النتائج النهائية للتحدي" : "Final challenge scores"}
        >
          {challenge.participants.map((participant) => {
            const winner = challenge.winnerKey === participant.key;
            const percentage = maxValue
              ? Math.min(100, Math.round((participant.value / maxValue) * 100))
              : 0;
            return (
              <article key={participant.key} data-winner={winner}>
                <span>
                  {winner
                    ? ar
                      ? "النتيجة المتقدمة"
                      : "Leading result"
                    : challenge.winnerKey
                      ? ar
                        ? "النتيجة النهائية"
                        : "Final result"
                      : ar
                        ? "نتيجة متعادلة"
                        : "Level result"}
                </span>
                <h2>{participant.name}</h2>
                <small>
                  {ar ? `السنة ${participant.academicYear}` : `Year ${participant.academicYear}`}
                </small>
                <strong>{participant.value}</strong>
                <div className="public-score-track" aria-hidden="true">
                  <span style={{ width: `${percentage}%` }} />
                </div>
                <p>{challengeUnit(challenge.type, participant.value, locale)}</p>
              </article>
            );
          })}
        </section>
        <footer>
          <p>
            {challenge.winnerKey
              ? ar
                ? "تحدٍ مكتمل مبني على نشاط دراسي مؤهل وقابل للمراجعة."
                : "A completed challenge built from eligible, auditable study activity."
              : ar
                ? "تحدٍ مكتمل دون نتيجة متقدمة واحدة."
                : "A completed challenge with no single leading result."}
          </p>
          <small>
            {ar
              ? "الافتراضي هو الاسم الأول والسنة الدراسية فقط. لا تظهر المعرّفات الجامعية."
              : "First name and academic year only by default. College identifiers are never shown."}
          </small>
        </footer>
      </article>
    </main>
  );
}
