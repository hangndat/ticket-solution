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
import { MarketingNeonInteriorRibbons } from './marketing-neon-interior-ribbons';

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
        <main id="main" className="relative isolate" data-testid={`sales-${locale}`}>
          <MarketingNeonInteriorRibbons />
          <HeroSection {...sectionProps} />
          <NeonEventsSection {...sectionProps} />
          <NeonProductSection {...sectionProps} />
          <NeonFinalCtaSection {...sectionProps} />
        </main>
      </MarketingChrome>
    </MarketingInterestProvider>
  );
}
