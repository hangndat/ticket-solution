import { supportMetadata } from '../../../../src/marketing/seo/metadata';
import { SupportPage } from '../../../../src/marketing/legal-pages';

export const metadata = supportMetadata('en');

export default function MarketingSupportEnPage() {
  return <SupportPage locale="en" />;
}
