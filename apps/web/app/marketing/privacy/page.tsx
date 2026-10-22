import { privacyMetadata } from '../../../src/marketing/seo/metadata';
import { PrivacyPage } from '../../../src/marketing/legal-pages';

export const metadata = privacyMetadata('vi');

export default function MarketingPrivacyViPage() {
  return <PrivacyPage locale="vi" />;
}
