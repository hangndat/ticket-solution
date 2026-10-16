import { Text } from 'react-native';
import { Page, Notice } from '@/components/page';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import { colors } from '@/theme/colors';
export function EventDetailScreen({
  tenantSlug,
  slug,
  fixture = false,
}: {
  tenantSlug: string;
  slug: string;
  fixture?: boolean;
}) {
  const event = findDemoEvent(tenantSlug, slug);
  if (!event)
    return (
      <Page>
        <Notice title={fixture ? 'Fixture not in catalog' : 'Event unavailable'}>
          {fixture
            ? 'No fixture in the demo catalog matches this event id. This link does not load a live event.'
            : 'No demo event matches this organization and event link. Return to Events to browse the directory.'}
        </Notice>
      </Page>
    );
  return (
    <Page>
      {fixture ? (
        <Notice title="Fixture">
          Fixture from the demo catalog. This is not a published live event.
        </Notice>
      ) : null}
      <Notice title={event.name}>{event.brand.organizationName}</Notice>
      <Text selectable style={{ color: colors.label, fontSize: 19 }}>
        {eventDate(event)}
      </Text>
      <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
        {event.timezone}
      </Text>
      <Text selectable style={{ color: colors.label, fontSize: 19 }}>
        {event.location}
      </Text>
      <Notice title="Demo preview">
        Sample event information only. Ticket registration is not available in
        this foundation build.
      </Notice>
    </Page>
  );
}
