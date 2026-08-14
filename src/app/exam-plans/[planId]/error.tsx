"use client";

export default function ExamPlanError({ retry }: { retry: () => void }) {
  return (
    <main className="exam-plan-detail-shell">
      <div className="session-state" role="alert">
        <h1>The exam plan could not be loaded.</h1>
        <p>Your saved proposal was not changed.</p>
        <button className="primary-button" onClick={retry}>
          Try again
        </button>
      </div>
    </main>
  );
}
