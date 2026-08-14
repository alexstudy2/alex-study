export default function ChallengesLoading() {
  return (
    <main className="challenge-shell" aria-busy="true" aria-live="polite">
      <div className="challenge-loading">
        <span className="loader" aria-hidden="true" />
        <p>Loading challenges…</p>
      </div>
    </main>
  );
}
