import { redirect } from 'next/navigation';
import { journeyHref } from '../../../src/marketing/links';

export default function MarketingJourneyViPage() {
  redirect(journeyHref('vi'));
}
