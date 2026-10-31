import {
  demoHref,
  loginHref,
  productOriginFromEnv,
  type MarketingLocale,
} from './hosts';
import { MarketingChrome } from './chrome';
import { HeroSection } from './sections/hero';
import { NeonFinalCta, NeonShowcase } from './sections/neon-showcase';
import { MarketingInterestDialog } from './marketing-interest-dialog';

export function SalesPage({ locale }: { locale: MarketingLocale }) {
  const productOrigin = productOriginFromEnv();
  const sectionProps = {
    locale,
    demo: demoHref(productOrigin),
    login: loginHref(productOrigin),
  };

  return (
    <MarketingInterestDialog locale={locale} demo={sectionProps.demo}>
      <MarketingChrome locale={locale} pageKind="sales">
        <main id="main" data-testid={`sales-${locale}`}>
          <HeroSection {...sectionProps} />
          <NeonShowcase {...sectionProps} />
          <NeonFinalCta {...sectionProps} />
        </main>
      </MarketingChrome>
    </MarketingInterestDialog>
  );
}
