import { salesMetadata } from '../../src/marketing/seo/metadata';
import { SalesPage } from '../../src/marketing/sales-page';

export const metadata = salesMetadata('vi');

export default function MarketingSalesViPage() {
  return <SalesPage locale="vi" />;
}
