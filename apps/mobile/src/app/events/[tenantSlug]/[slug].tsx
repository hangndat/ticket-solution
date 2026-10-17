import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '@/screens/event-detail';
export default function EventRoute() {
  const { tenantSlug, slug } = useLocalSearchParams<{
    tenantSlug: string;
    slug: string;
  }>();
  const tenant = typeof tenantSlug === 'string' ? tenantSlug : '';
  const eventSlug = typeof slug === 'string' ? slug : '';
  // Remount on route change so loading phase resets without setState-in-effect.
  return (
    <EventDetailScreen
      key={`published:${tenant}:${eventSlug}`}
      tenantSlug={tenant}
      slug={eventSlug}
    />
  );
}
