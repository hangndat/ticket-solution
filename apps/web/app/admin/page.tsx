import Link from 'next/link';
export const metadata = { title: 'Admin shell' };
export default function Admin() {
  return (
    <main id="main" className="container shell">
      <p className="eyebrow">W0 / UNIMPLEMENTED SHELL</p>
      <h1>Administration</h1>
      <aside className="notice">
        <h2>Not authenticated. Not implemented.</h2>
        <p>
          This publicly accessible placeholder grants no staff access and
          displays no private data. Tenant administration, membership, event
          management and Gate operations require future backend authorization
          and identity integration.
        </p>
      </aside>
      <Link href="/">← Return to demo events</Link>
    </main>
  );
}
