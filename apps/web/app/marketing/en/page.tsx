import { salesMetadata } from '../../../src/marketing/seo/metadata';
import { SalesPage } from '../../../src/marketing/sales-page';

export const metadata = salesMetadata('en');

export default function MarketingSalesEnPage() {
  return <SalesPage locale="en" />;
}
