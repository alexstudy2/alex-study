export default function ChallengesLoading() {
  return (
    <main className="page-shell" aria-busy="true" aria-live="polite">
      <div className="challenge-loading">
        <span className="loader" aria-hidden="true" />
        <p>Loading challenges… · جاري تحميل التحديات...</p>
      </div>
    </main>
  );
}
