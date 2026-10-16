'use client';
import Link from 'next/link';
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="container shell">
      <h1>This page couldn’t load.</h1>
      <p>
        Please try again. No ticketing action has been performed by this demo.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
      <p>
        <Link href="/">Return to demo events</Link>
      </p>
    </main>
  );
}
