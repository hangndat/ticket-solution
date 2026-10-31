import { Button } from '@ticket/ui';
import type { Metadata } from 'next';
import { MarketingChrome } from '../chrome';
import { t } from '../copy';
import { demoHref, marketingOriginFromEnv, productOriginFromEnv, type MarketingLocale } from '../hosts';
import { MarketingHtmlAttrs } from '../html-attrs';
import { journeyHref, salesHref } from '../links';
import { marketingPageMetadata } from '../seo/metadata';
import { journeyCopy } from './copy';
import { JourneyExperience } from './journey-experience';
import { JOURNEY_INDEXABLE } from './publication';
import { MarketingAnalyticsClient } from '../analytics/client';
import { MarketingJsonLd } from '../seo/json-ld';

/** Public URL, but excluded from search until release approval. */
export function journeyMetadata(locale: MarketingLocale): Metadata {
  const copy = journeyCopy(locale);
  const metadata = marketingPageMetadata({
      locale,
      pageKind: 'journey',
      title: copy.metaTitle,
      description: copy.metaDescription,
    });
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: `${marketingOriginFromEnv()}${journeyHref(locale)}`,
    },
    robots: { index: JOURNEY_INDEXABLE, follow: true },
  };
}

export function JourneyPage({ locale }: { locale: MarketingLocale }) {
  const copy = journeyCopy(locale);
  const demo = demoHref(productOriginFromEnv());
  const cta = (
    <>
      <Button asChild variant="primary" data-testid="cta-demo" data-analytics-cta="journey_demo">
        <a href={demo}>{t(locale, 'demo.cta')}</a>
      </Button>
      <Button asChild variant="ghostOnInk" data-testid="cta-interest">
        <a href={`${salesHref(locale)}#interest`}>{t(locale, 'nav.interest')}</a>
      </Button>
    </>
  );

  return (
    <MarketingChrome locale={locale} pageKind="journey">
      {/* Layout does not re-render on client locale switch; keep <html lang> in sync per page. */}
      <MarketingHtmlAttrs locale={locale} />
      <main id="main" lang={locale} data-journey="" data-analytics-surface="journey" data-testid={`journey-${locale}`}>
        <JourneyExperience key={locale} locale={locale} copy={copy} cta={cta} />
      </main>
    </MarketingChrome>
  );
}

/** Synchronous public route: prerender all still frames, without the async marketing loading boundary. */
export function PublicJourneyPage({ locale }: { locale: MarketingLocale }) {
  return (
    <div lang={locale}>
      <MarketingJsonLd locale={locale} />
      <MarketingAnalyticsClient />
      <JourneyPage locale={locale} />
    </div>
  );
}
