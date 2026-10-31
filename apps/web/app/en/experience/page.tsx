import { PublicJourneyPage, journeyMetadata } from '../../../src/marketing/journey/journey-page';

export const metadata = journeyMetadata('en');

export default function ExperienceEnPage() {
  return <PublicJourneyPage locale="en" />;
}
