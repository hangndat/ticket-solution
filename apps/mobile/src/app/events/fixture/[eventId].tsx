import { useLocalSearchParams } from 'expo-router';
import { Notice, Page } from '@/components/page';
import { findDemoEventById } from '@/data/demo-events';
import { fixtureEventRouteAllowed } from '@/navigation/dev-only-routes';
import { EventDetailScreen } from '@/screens/event-detail';

export default function FixtureEventRoute() {
  if (!fixtureEventRouteAllowed()) {
    return (
      <Page>
        <Notice title="Không có sự kiện demo" tone="deny">
          Đường dẫn sự kiện demo chỉ dùng khi phát triển hoặc UAT local. Không
          cho vào trên bản phát hành.
        </Notice>
      </Page>
    );
  }

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
