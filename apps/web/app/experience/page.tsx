import { PublicJourneyPage, journeyMetadata } from '../../src/marketing/journey/journey-page';

export const metadata = journeyMetadata('vi');

export default function ExperienceViPage() {
  return <PublicJourneyPage locale="vi" />;
}
