import type { Metadata } from 'next';
import { t } from '../../../src/marketing/copy';
import { PrivacyPage } from '../../../src/marketing/legal-pages';

export const metadata: Metadata = {
  title: t('vi', 'privacy.title'),
  description: t('vi', 'privacy.intro'),
  robots: { index: true, follow: true },
};

export default function MarketingPrivacyViPage() {
  return <PrivacyPage locale="vi" />;
}
