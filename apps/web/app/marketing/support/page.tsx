import { supportMetadata } from '../../../src/marketing/seo/metadata';
import { SupportPage } from '../../../src/marketing/legal-pages';

export const metadata = supportMetadata('vi');

export default function MarketingSupportViPage() {
  return <SupportPage locale="vi" />;
}
