import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { demoTenants, eventDate, listDemoEvents } from '@/data/demo-events';
import { Notice } from '@/components/page';
import { fetchPublishedEventList } from '@/published/published-event-api';
import type { PublishedEventSummary } from '@/published/types';
import { getApiBaseUrl } from '@/identity/config';
import { colors } from '@/theme/colors';

function formatListDate(startsAt: string, timezone: string): string {
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

/**
 * Events home: demo fixtures are explicitly labeled and never claimed as
 * published M04 content. Published list loads on demand (button) — fail-closed.
 */
export function EventsScreen() {
  const [tenant, setTenant] = useState<string>(demoTenants[0]);
  const [publishedTenant, setPublishedTenant] = useState('demo-fun');
  const [published, setPublished] = useState<PublishedEventSummary[]>([]);
  const [publishedPhase, setPublishedPhase] = useState<
    'idle' | 'loading' | 'ready' | 'error' | 'misconfigured'
  >(() => (getApiBaseUrl() ? 'idle' : 'misconfigured'));
  const [publishedError, setPublishedError] = useState<string | null>(null);

  const loadPublished = useCallback(async () => {
    if (!getApiBaseUrl()) {
      setPublishedPhase('misconfigured');
      setPublished([]);
      return;
    }
    setPublishedPhase('loading');
    setPublishedError(null);
    const result = await fetchPublishedEventList(publishedTenant, { limit: 20 });
    if (result.status === 'ok') {
      setPublished(result.body.items);
      setPublishedPhase('ready');
      return;
    }
    setPublished([]);
    setPublishedPhase('error');
    setPublishedError(
      result.status === 'misconfigured'
        ? 'API base URL missing'
        : 'Published list unreachable or invalid — fixtures are not used as fallback.',
    );
  }, [publishedTenant]);

  const demoEvents = listDemoEvents(tenant);

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      data={demoEvents}
      keyExtractor={(item) => `demo:${item.tenantSlug}:${item.id}`}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Notice title="Find your next moment">
            Demo fixtures below are explicit sample data — not shared published
            M04 content. Live registration uses Redeem; ticket deep links require
            ticket ownership via GET /v1/me/tickets.
          </Notice>
          <Link href="/redeem" style={{ color: colors.accent, fontSize: 17 }}>
            Redeem a code
          </Link>

          <Notice title="Published events (server)">
            GET /v1/public/tenants/{'{slug}'}/events — published-only. Fail-closed
            when the API is missing; never substitutes the demo catalog. Tap
            reload to fetch (no silent fallback).
          </Notice>
          <Text selectable style={{ color: colors.secondary }}>
            Published tenant slug: {publishedTenant}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload published events"
            onPress={() => void loadPublished()}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {publishedPhase === 'loading'
                ? 'Loading published…'
                : 'Load published list'}
            </Text>
          </Pressable>
          {publishedPhase === 'loading' ? <ActivityIndicator /> : null}
          {publishedPhase === 'misconfigured' ? (
            <Notice title="Published API not configured">
              Set EXPO_PUBLIC_API_BASE_URL. Demo fixtures remain labeled demo
              only.
            </Notice>
          ) : null}
          {publishedPhase === 'idle' ? (
            <Notice title="Published list idle">
              Tap “Load published list” to call the public API.
            </Notice>
          ) : null}
          {publishedPhase === 'error' && publishedError ? (
            <Notice title="Published list error">{publishedError}</Notice>
          ) : null}
          {publishedPhase === 'ready' && published.length === 0 ? (
            <Notice title="No published events">
              API returned an empty published list for this tenant.
            </Notice>
          ) : null}
          {published.map((item) => (
            <View
              key={`pub:${item.id}`}
              style={{
                padding: 16,
                gap: 8,
                backgroundColor: colors.card,
                borderRadius: 16,
                borderTopWidth: 4,
                borderTopColor: item.brand.primaryColor,
              }}
            >
              <Text selectable style={{ color: colors.secondary, fontSize: 13 }}>
                Published · v{item.publishedConfigVersion}
              </Text>
              <Text selectable style={{ color: colors.secondary }}>
                {item.brand.organizationName}
              </Text>
              <Link
                href={{
                  pathname: '/events/[tenantSlug]/[slug]',
                  params: { tenantSlug: item.tenantSlug, slug: item.slug },
                }}
                style={{
                  color: colors.accent,
                  fontSize: 22,
                  fontWeight: '600',
                  paddingVertical: 4,
                }}
              >
                {item.name}
              </Link>
              <Text selectable style={{ color: colors.label }}>
                {item.startsAt
                  ? formatListDate(item.startsAt, item.timezone)
                  : 'Start time unset'}
              </Text>
            </View>
          ))}

          <Text
            selectable
            style={{ color: colors.secondary, marginTop: 8, fontWeight: '600' }}
          >
            Demo fixtures · Organization: {tenant}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setTenant(
                tenant === demoTenants[0] ? demoTenants[1] : demoTenants[0],
              )
            }
            style={({ pressed }) => ({
              paddingVertical: 14,
              paddingHorizontal: 18,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.label,
                fontSize: 17,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              Switch demo organization
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              setPublishedTenant((t) =>
                t === 'demo-fun' ? 'demo-studio' : 'demo-fun',
              )
            }
            style={({ pressed }) => ({
              paddingVertical: 10,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.accent, textAlign: 'center' }}>
              Toggle published tenant slug probe
            </Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <Notice title="No demo events">
          This organization has no demo events.
        </Notice>
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: 20,
            gap: 12,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderCurve: 'continuous',
            borderTopWidth: 4,
            borderTopColor: item.brand.primaryColor,
          }}
        >
          <Text selectable style={{ color: colors.secondary, fontSize: 13 }}>
            Demo fixture · not published
          </Text>
          <Text selectable style={{ color: colors.secondary }}>
            {item.brand.organizationName}
          </Text>
          <Link
            href={{
              pathname: '/events/fixture/[eventId]',
              params: { eventId: item.id },
            }}
            style={{
              color: colors.accent,
              fontSize: 24,
              fontWeight: '600',
              paddingVertical: 8,
            }}
          >
            {item.name}
          </Link>
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {eventDate(item)}
          </Text>
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            {item.location}
          </Text>
        </View>
      )}
    />
  );
}
