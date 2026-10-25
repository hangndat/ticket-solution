'use client';

import { Button } from '@ticket/ui';
import { t } from './copy';
import type { MarketingLocale } from './hosts';
import { InterestCtaLink } from './interest-cta-link';

export function MarketingDesktopInterestCta({
  locale,
  sales,
}: {
  locale: MarketingLocale;
  sales: string;
}) {
  return (
    <Button
      asChild
      variant="primary"
      className="shrink-0 whitespace-nowrap max-md:hidden"
    >
      <InterestCtaLink href={`${sales}#interest`} data-testid="cta-interest-nav">
        {t(locale, 'nav.interest')}
      </InterestCtaLink>
    </Button>
  );
}
