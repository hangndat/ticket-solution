import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Page, Notice } from '@/components/page';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import {
  fetchPublishedEventDetail,
  visibleSectionsInOrder,
} from '@/published/published-event-api';
import type { PublishedEventDetail } from '@/published/types';
import { colors } from '@/theme/colors';

export function EventDetailScreen({
  tenantSlug,
  slug,
  fixture = false,
}: {
  tenantSlug: string;
  slug: string;
  /** Explicit demo catalog only — never a fallback for production publish. */
  fixture?: boolean;
}) {
  if (fixture) {
    return <FixtureDemoDetail tenantSlug={tenantSlug} slug={slug} />;
  }
  return <PublishedEventDetailView tenantSlug={tenantSlug} slug={slug} />;
}

function FixtureDemoDetail({
  tenantSlug,
  slug,
}: {
  tenantSlug: string;
  slug: string;
}) {
  const event = findDemoEvent(tenantSlug, slug);
  if (!event) {
    return (
      <Page>
        <Notice title="Fixture not in catalog">
          No fixture in the demo catalog matches this event id. This link does
          not load a live published event and must not be treated as M04 shared
          content.
        </Notice>
      </Page>
    );
  }
  return (
    <Page>
      <Notice title="Demo fixture (not published)">
        Explicit W0/demo catalog only. Not server-published M04 content. Brand /
        FAQ / terms here are sample strings, not a publishedConfigVersion.
      </Notice>
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
      <Notice title="Registration">
        Sample event information only. Ticket registration is not available from
        fixtures.
      </Notice>
    </Page>
  );
}

function PublishedEventDetailView({
  tenantSlug,
  slug,
}: {
  tenantSlug: string;
  slug: string;
}) {
  const [phase, setPhase] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; event: PublishedEventDetail }
    | { kind: 'not-found' }
    | { kind: 'error'; message: string }
    | { kind: 'misconfigured' }
  >({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      const result = await fetchPublishedEventDetail(
        tenantSlug,
        slug,
        controller.signal,
      );
      if (cancelled) return;
      if (result.status === 'ok') {
        setPhase({ kind: 'ready', event: result.event });
        return;
      }
      if (result.status === 'not-found') {
        setPhase({ kind: 'not-found' });
        return;
      }
      if (result.status === 'misconfigured') {
        setPhase({ kind: 'misconfigured' });
        return;
      }
      setPhase({
        kind: 'error',
        message:
          result.status === 'unreachable'
            ? 'Published content API unreachable. Fail-closed — demo fixtures are not used as a fallback.'
            : 'Published content response invalid. Fail-closed.',
      });
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantSlug, slug]);

  if (phase.kind === 'loading') {
    return (
      <Page>
        <View style={{ padding: 16, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ color: colors.secondary, marginTop: 8 }}>
            Loading published event…
          </Text>
        </View>
      </Page>
    );
  }

  if (phase.kind === 'misconfigured') {
    return (
      <Page>
        <Notice title="Published API not configured">
          Set EXPO_PUBLIC_API_BASE_URL to load GET
          /v1/public/tenants/…/events/…. Demo fixtures stay on the fixture route
          only — they are not substituted here.
        </Notice>
      </Page>
    );
  }

  if (phase.kind === 'not-found') {
    return (
      <Page>
        <Notice title="Event unavailable">
          No published projection for this organization/event (404). Drafts are
          never shown. This is not a demo fixture.
        </Notice>
      </Page>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Page>
        <Notice title="Published content error">{phase.message}</Notice>
      </Page>
    );
  }

  const event = phase.event;
  const sections = visibleSectionsInOrder(event);

  return (
    <Page>
      <Notice title="Published content">
        Server projection · config v{event.publishedConfigVersion} · schema v
        {event.schemaVersion}. Not a demo fixture.
      </Notice>
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderTopWidth: 4,
          borderTopColor: event.brand.primaryColor,
          gap: 8,
        }}
      >
        <Text selectable style={{ color: colors.secondary }}>
          {event.brand.organizationName}
        </Text>
        <Text
          selectable
          style={{ color: colors.label, fontSize: 24, fontWeight: '600' }}
        >
          {event.name}
        </Text>
        {event.startsAt ? (
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {formatPublishedDate(event.startsAt, event.timezone)}
          </Text>
        ) : (
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            Start time not set on published metadata
          </Text>
        )}
        {event.location ? (
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {event.location}
          </Text>
        ) : null}
        {event.brand.contact ? (
          <Text selectable style={{ color: colors.secondary, fontSize: 15 }}>
            {event.brand.contact}
          </Text>
        ) : null}
      </View>

      {sections.map((section) => (
        <Notice key={section.id} title={section.title ?? section.kind}>
          {section.bodyMarkdown?.trim() || `(${section.kind})`}
        </Notice>
      ))}

      {event.faq.length > 0 ? (
        <Notice title="FAQ">
          {event.faq.map((item, index) => (
            <Text
              key={`${item.q}-${index}`}
              selectable
              style={{ marginBottom: 8, color: colors.label }}
            >
              Q: {item.q}
              {'\n'}
              A: {item.a}
            </Text>
          ))}
        </Notice>
      ) : null}

      {event.terms ? (
        <Notice title={`Terms (${event.terms.version})`}>
          {event.terms.bodyMarkdown}
        </Notice>
      ) : null}
    </Page>
  );
}

function formatPublishedDate(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}
