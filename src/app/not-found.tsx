import Link from "next/link";

export default function NotFound() {
  return (
    <main className="launch-state">
      <p className="eyebrow">404 · Alex Study</p>
      <h1>This page is not in the study plan.</h1>
      <p>The link may be old, private, or no longer available.</p>
      <Link className="primary-button" href="/">
        Return home
      </Link>
    </main>
  );
}
