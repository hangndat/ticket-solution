import {
  demoHref,
  loginHref,
  productOriginFromEnv,
  type MarketingLocale,
} from './hosts';
import { MarketingChrome } from './chrome';
import { HeroSection } from './sections/hero';
import { MarketingInterestProvider } from './marketing-interest-provider';
import { NeonEventsSection } from './sections/neon-events';
import { NeonFinalCtaSection } from './sections/neon-final-cta';
import { NeonProductSection } from './sections/neon-product';

export function SalesPage({ locale }: { locale: MarketingLocale }) {
  const productOrigin = productOriginFromEnv();
  const sectionProps = {
    locale,
    demo: demoHref(productOrigin),
    login: loginHref(productOrigin),
  };

  return (
    <MarketingInterestProvider locale={locale} demo={sectionProps.demo}>
      <MarketingChrome locale={locale} pageKind="sales">
        <main id="main" data-testid={`sales-${locale}`}>
          <HeroSection {...sectionProps} />
          <NeonEventsSection {...sectionProps} />
          <NeonProductSection {...sectionProps} />
          <NeonFinalCtaSection {...sectionProps} />
        </main>
      </MarketingChrome>
    </MarketingInterestProvider>
  );
}
