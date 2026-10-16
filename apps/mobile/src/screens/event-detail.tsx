import { Text } from 'react-native';
import { Page, Notice } from '@/components/page';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import { colors } from '@/theme/colors';
export function EventDetailScreen({
  tenantSlug,
  slug,
}: {
  tenantSlug: string;
  slug: string;
}) {
  const event = findDemoEvent(tenantSlug, slug);
  if (!event)
    return (
      <Page>
        <Notice title="Event unavailable">
          No demo event matches this organization and event link. Return to
          Events to browse the directory.
        </Notice>
      </Page>
    );
  return (
    <Page>
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
