"use client";

export default function LeaderboardError({ reset }: { reset: () => void }) {
  return (
    <main className="leaderboard-shell">
      <div className="challenge-empty" role="alert">
        <h1>Leaderboard unavailable</h1>
        <p>تعذر تحميل الترتيب الآن. Your privacy setting has not been changed.</p>
        <button className="primary-button" onClick={reset}>
          Try again · حاول مرة أخرى
        </button>
      </div>
    </main>
  );
}
