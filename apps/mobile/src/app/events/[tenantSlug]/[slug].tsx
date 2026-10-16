import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '@/screens/event-detail';
export default function EventRoute() {
  const { tenantSlug, slug } = useLocalSearchParams<{
    tenantSlug: string;
    slug: string;
  }>();
  return <EventDetailScreen tenantSlug={tenantSlug} slug={slug} />;
}
