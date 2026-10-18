import type { Metadata } from 'next';
import { t } from '../../../src/marketing/copy';
import { SalesPage } from '../../../src/marketing/sales-page';

export const metadata: Metadata = {
  title: t('en', 'meta.title'),
  description: t('en', 'meta.description'),
  robots: { index: true, follow: true },
};

export default function MarketingSalesEnPage() {
  return <SalesPage locale="en" />;
}
