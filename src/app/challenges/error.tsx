"use client";

export default function ChallengesError({ reset }: { reset: () => void }) {
  return (
    <main className="challenge-shell">
      <div className="challenge-empty" role="alert">
        <h1>Challenges need a moment</h1>
        <p>تعذر فتح التحديات الآن. Your challenge data has not been changed.</p>
        <button className="primary-button" onClick={reset}>
          Try again · حاول مرة أخرى
        </button>
      </div>
    </main>
  );
}
