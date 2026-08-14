"use client";
export default function FocusError({ reset }: { reset: () => void }) {
  return (
    <main className="focus-shell">
      <div className="session-state">
        <h1>Focus space unavailable</h1>
        <p>Your timer data is safe. Try loading it again.</p>
        <button className="primary-button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
