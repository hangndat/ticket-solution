import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { VEMOKI_BRAND_COLORS } from '@ticket/ui';

export const metadata: Metadata = {
  title: 'Design system (dev)',
  robots: { index: false, follow: false },
};

/** Internal pipeline smoke page — not linked from prod chrome; 404 in production builds. */
export default function DevDesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main id="main" className="container" style={{ paddingBlock: 'var(--space-6)' }}>
      <h1>Design system — slice 0</h1>
      <p>Token pipeline only; no Aceternity components in this slice.</p>
      <ul>
        {Object.entries(VEMOKI_BRAND_COLORS).map(([name, hex]) => (
          <li key={name}>
            <span
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                background: hex,
                marginRight: 8,
                verticalAlign: 'middle',
                border: '1px solid var(--line)',
              }}
              aria-hidden
            />
            {name}: {hex}
          </li>
        ))}
      </ul>
    </main>
  );
}
