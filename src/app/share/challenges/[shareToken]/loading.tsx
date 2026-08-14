export default function SharedChallengeLoading() {
  return (
    <main className="public-challenge-shell" aria-busy="true" aria-live="polite">
      <div className="challenge-loading">
        <span className="loader" aria-hidden="true" />
        <p>Loading shared result…</p>
      </div>
    </main>
  );
}
