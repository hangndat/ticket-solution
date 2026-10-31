import {
  demoHref,
  loginHref,
  productOriginFromEnv,
  type MarketingLocale,
} from './hosts';
import { MarketingChrome } from './chrome';
import { AudienceSection } from './sections/audience';
import { CtaSection } from './sections/cta';
import { FaqSection } from './sections/faq';
import { HeroSection } from './sections/hero';
import { OutcomesSection } from './sections/outcomes';
import { BentoSection } from './sections/bento';
import { TrustSection } from './sections/trust';
import { WorkflowSection } from './sections/workflow';
import { NeonFinalCta, NeonShowcase } from './sections/neon-showcase';

export function SalesPage({ locale }: { locale: MarketingLocale }) {
  const productOrigin = productOriginFromEnv();
  const sectionProps = {
    locale,
    demo: demoHref(productOrigin),
    login: loginHref(productOrigin),
  };

  return (
    <MarketingChrome locale={locale} pageKind="sales">
      <main id="main" data-testid={`sales-${locale}`}>
        <HeroSection {...sectionProps} />
        <NeonShowcase {...sectionProps} />
        <TrustSection {...sectionProps} />
        <BentoSection {...sectionProps} />
        <WorkflowSection {...sectionProps} />
        <AudienceSection {...sectionProps} />
        <OutcomesSection {...sectionProps} />
        <FaqSection {...sectionProps} />
        <NeonFinalCta {...sectionProps} />
        <CtaSection {...sectionProps} />
      </main>
    </MarketingChrome>
  );
}
