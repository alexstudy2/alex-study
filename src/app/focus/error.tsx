"use client";
export default function FocusError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <div className="session-state">
        <h1>Focus space unavailable · مساحة التركيز غير متاحة</h1>
        <p>Your timer data is safe. Try loading it again. · بيانات المؤقت الخاصة بك آمنة. حاول تحميلها مرة أخرى.</p>
        <button className="primary-button" onClick={reset}>
          Try again · حاول مرة أخرى
        </button>
      </div>
    </main>
  );
}
