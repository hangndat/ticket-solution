import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '@/screens/event-detail';
import { findDemoEventById } from '@/data/demo-events';

export default function FixtureEventRoute() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const id = typeof eventId === 'string' ? eventId : '';
  const event = findDemoEventById(id);
  if (!event) {
    return <EventDetailScreen tenantSlug="" slug="" fixture />;
  }
  return (
    <EventDetailScreen
      tenantSlug={event.tenantSlug}
      slug={event.slug}
      fixture
    />
  );
}
