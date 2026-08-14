"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="launch-state">
          <p className="eyebrow">Alex Study</p>
          <h1>Something interrupted this page.</h1>
          <p>Your saved study data is unchanged. Try loading the page again.</p>
          <button className="primary-button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
