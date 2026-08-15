"use client";

export default function FocusError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell flex items-center justify-center min-h-[60vh]">
      <div className="session-state max-w-md w-full p-6 text-center">
        <h2>Something went wrong</h2>
        <p className="mt-2 text-muted">Your timer data is safe. Try loading it again.</p>
        <button className="primary-button mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
