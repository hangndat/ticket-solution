import { redirect } from 'next/navigation';
import { journeyHref } from '../../../../src/marketing/links';

export default function MarketingJourneyEnPage() {
  redirect(journeyHref('en'));
}
