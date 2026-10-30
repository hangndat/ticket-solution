import { JourneyPage, journeyMetadata } from '../../../src/marketing/journey/journey-page';

export const metadata = journeyMetadata('vi');

export default function MarketingJourneyViPage() {
  return <JourneyPage locale="vi" />;
}
