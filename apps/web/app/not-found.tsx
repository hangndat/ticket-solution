import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="container shell">
      <p className="eyebrow">404 / EVENT NOT FOUND</p>
      <h1>
        Nothing here,
        <br />
        just yet.
      </h1>
      <p>We couldn’t find that tenant and event combination.</p>
      <Link className="button" href="/">
        Browse demo events
      </Link>
    </main>
  );
}
