export default function ChallengeLoading() {
  return (
    <main className="challenge-detail-shell" aria-busy="true" aria-live="polite">
      <div className="challenge-loading">
        <span className="loader" aria-hidden="true" />
        <p>Loading challenge… · جاري تحميل التحدي...</p>
      </div>
    </main>
  );
}
