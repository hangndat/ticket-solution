import { privacyMetadata } from '../../../../src/marketing/seo/metadata';
import { PrivacyPage } from '../../../../src/marketing/legal-pages';

export const metadata = privacyMetadata('en');

export default function MarketingPrivacyEnPage() {
  return <PrivacyPage locale="en" />;
}
