import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { MarketingAnalyticsClient } from '../../src/marketing/analytics/client';
import { MarketingHtmlAttrs } from '../../src/marketing/html-attrs';
import { MarketingJsonLd } from '../../src/marketing/seo/json-ld';
import '../marketing-uplift.css';

/**
 * Marketing-only dynamic boundary (headers for locale/surface).
 * Keeps root layout sync so /t/[tenant]/events/[event] stays static +
 * dynamicParams=false → 404 for unknown pairs.
 */
export default async function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  const h = await headers();
  const locale = h.get('x-vemoki-locale') === 'en' ? 'en' : 'vi';

  return (
    <>
      <MarketingHtmlAttrs locale={locale} />
      <MarketingJsonLd locale={locale} />
      <MarketingAnalyticsClient />
      {/* Hide product shell footer when marketing chrome is present */}
      <style>{`body:has([data-testid="marketing-surface"]) > .footer{display:none}
body:has([data-testid="marketing-surface"]) > .demo-data-strip{display:none}`}</style>
      {children}
    </>
  );
}
