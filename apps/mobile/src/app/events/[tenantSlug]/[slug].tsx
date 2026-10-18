import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '@/screens/event-detail';

function isExplicitFixtureFlag(value: string | string[] | undefined): boolean {
  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }
  if (Array.isArray(value)) {
    return value.some((v) => v === 'true' || v === '1');
  }
  return false;
}

export default function EventRoute() {
  const { tenantSlug, slug, fixture } = useLocalSearchParams<{
    tenantSlug: string;
    slug: string;
    fixture?: string;
  }>();
  const tenant = typeof tenantSlug === 'string' ? tenantSlug : '';
  const eventSlug = typeof slug === 'string' ? slug : '';
  const useFixture = isExplicitFixtureFlag(fixture);
  // Remount on route change so loading phase resets without setState-in-effect.
  // fixture=true is an explicit DEMO path — never inferred from API failure.
  return (
    <EventDetailScreen
      key={`${useFixture ? 'fixture' : 'published'}:${tenant}:${eventSlug}`}
      tenantSlug={tenant}
      slug={eventSlug}
      fixture={useFixture}
    />
  );
}
