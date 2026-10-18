import type { Metadata } from 'next';
import { t } from '../../src/marketing/copy';
import { SalesPage } from '../../src/marketing/sales-page';

export const metadata: Metadata = {
  title: t('vi', 'meta.title'),
  description: t('vi', 'meta.description'),
  robots: { index: true, follow: true },
};

export default function MarketingSalesViPage() {
  return <SalesPage locale="vi" />;
}
