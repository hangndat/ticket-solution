import { JourneyPage, journeyMetadata } from '../../../../src/marketing/journey/journey-page';

export const metadata = journeyMetadata('en');

export default function MarketingJourneyEnPage() {
  return <JourneyPage locale="en" />;
}
