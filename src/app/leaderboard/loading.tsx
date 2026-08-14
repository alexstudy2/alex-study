export default function LeaderboardLoading() {
  return (
    <main className="page-shell" aria-busy="true" aria-live="polite">
      <div className="challenge-loading">
        <span className="loader" aria-hidden="true" />
        <p>Loading leaderboard…</p>
      </div>
    </main>
  );
}
