"use client";

export default function ChallengesError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <div className="challenge-empty" role="alert">
        <h1>Challenges need a moment · التحديات تحتاج لبعض الوقت</h1>
        <p>Your challenge data has not been changed. · تعذر فتح التحديات الآن. بياناتك لم تتغير.</p>
        <button className="primary-button" onClick={reset}>
          Try again · حاول مرة أخرى
        </button>
      </div>
    </main>
  );
}
