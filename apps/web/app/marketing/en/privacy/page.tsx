import type { Metadata } from 'next';
import { t } from '../../../../src/marketing/copy';
import { PrivacyPage } from '../../../../src/marketing/legal-pages';

export const metadata: Metadata = {
  title: t('en', 'privacy.title'),
  description: t('en', 'privacy.intro'),
  robots: { index: true, follow: true },
};

export default function MarketingPrivacyEnPage() {
  return <PrivacyPage locale="en" />;
}
