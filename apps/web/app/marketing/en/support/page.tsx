import type { Metadata } from 'next';
import { t } from '../../../../src/marketing/copy';
import { SupportPage } from '../../../../src/marketing/legal-pages';

export const metadata: Metadata = {
  title: t('en', 'support.title'),
  description: t('en', 'support.lead'),
  robots: { index: true, follow: true },
};

export default function MarketingSupportEnPage() {
  return <SupportPage locale="en" />;
}
