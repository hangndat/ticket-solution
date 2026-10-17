import type { Metadata } from 'next';
import { t } from '../../../src/marketing/copy';
import { SupportPage } from '../../../src/marketing/legal-pages';

export const metadata: Metadata = {
  title: t('vi', 'support.title'),
  description: t('vi', 'support.lead'),
  robots: { index: true, follow: true },
};

export default function MarketingSupportViPage() {
  return <SupportPage locale="vi" />;
}
