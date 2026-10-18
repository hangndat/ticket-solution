import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { demoTenants, eventDate, listDemoEvents } from '@/data/demo-events';
import { EventMediaHeader } from '@/components/event-media';
import { BrandWordmark } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { fetchPublishedEventList } from '@/published/published-event-api';
import {
  DEMO_PUBLISHED_TENANTS,
  initialPublishedListPhase,
  nextDemoPublishedTenant,
  publishedListStateFromResult,
  type PublishedListPhase,
} from '@/published/events-home';
import type { PublishedEventSummary } from '@/published/types';
import { getApiBaseUrl, showDemoEventCatalog } from '@/identity/config';
import { colors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

function formatListDate(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('vi', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

/**
 * Events home (ADR-19 / #257): published list is the FlatList SoT after load.
 * Fixture catalog is footer-only with explicit Demo labels — never API fallback.
 * Production / TestFlight (`showDemoEventCatalog() === false`) hides the W0
 * demo footer so home is redeem + published only.
 */
export function EventsScreen() {
  const { applyBranding, theme } = useTheme();
  const showDemo = showDemoEventCatalog();
  const [publishedTenant, setPublishedTenant] = useState<string>(
    DEMO_PUBLISHED_TENANTS[0],
  );
  const [published, setPublished] = useState<PublishedEventSummary[]>([]);
  const [publishedPhase, setPublishedPhase] = useState<PublishedListPhase>(() =>
    initialPublishedListPhase(Boolean(getApiBaseUrl())),
  );
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [demoTenant, setDemoTenant] = useState<string>(demoTenants[0]);

  const beginPublishedReload = () => {
    setPublishedPhase('loading');
    setPublishedError(null);
  };

  const retryPublished = () => {
    beginPublishedReload();
    setReloadKey((key) => key + 1);
  };

  const switchPublishedTenant = () => {
    beginPublishedReload();
    setPublishedTenant((tenant) => nextDemoPublishedTenant(tenant));
  };

  // Load published list after mount / tenant / retry — setState only after await.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      if (!getApiBaseUrl()) {
        if (cancelled) return;
        setPublished([]);
        setPublishedPhase('misconfigured');
        setPublishedError('Thiếu URL API');
        return;
      }
      const result = await fetchPublishedEventList(
        publishedTenant,
        { limit: 20 },
        controller.signal,
      );
      if (cancelled) return;
      const next = publishedListStateFromResult(result);
      setPublished(next.items);
      setPublishedPhase(next.phase);
      setPublishedError(next.errorMessage);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [publishedTenant, reloadKey]);

  // Brand chrome from first published row when list is ready — not from fixtures.
  useEffect(() => {
    if (publishedPhase !== 'ready' || published.length === 0) return;
    const first = published[0];
    applyBranding(
      {
        tenantSlug: first.tenantSlug,
        organizationName: first.brand.organizationName,
        primaryColor: first.brand.primaryColor,
        logoUrl: first.brand.logoUrl,
        wordmark: first.brand.organizationName,
      },
      'api',
    );
  }, [applyBranding, published, publishedPhase]);

  const demoEvents = showDemo ? listDemoEvents(demoTenant) : [];
  const listData =
    publishedPhase === 'ready' ? published : ([] as PublishedEventSummary[]);

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      data={listData}
      keyExtractor={(item) => `pub:${item.tenantSlug}:${item.id}`}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <BrandWordmark />
          <Text
            accessibilityLabel={`Tổ chức: ${publishedTenant}`}
            style={{ color: colors.secondary, ...typography.caption }}
            selectable
          >
            Tổ chức: {publishedTenant}
            {theme.organizationName ? ` · ${theme.organizationName}` : ''}
          </Text>
          <Text style={{ color: colors.label, ...typography.title }}>
            Tìm sự kiện tiếp theo
          </Text>
          <Text style={{ color: colors.secondary, ...typography.body }}>
            Danh sách lấy từ sự kiện đã xuất bản trên máy chủ. Đổi mã để nhận vé.
          </Text>
          <Link href="/redeem" style={{ color: colors.accent, fontSize: 17 }}>
            Đổi mã
          </Link>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tổ chức để tải danh sách đã xuất bản"
            onPress={switchPublishedTenant}
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
              Đổi tổ chức (API)
            </Text>
          </Pressable>

          {publishedPhase === 'loading' ? (
            <LoadingState title={eventsCopy.loadingList.title}>
              {eventsCopy.loadingList.body}
            </LoadingState>
          ) : null}
          {publishedPhase === 'misconfigured' ? (
            <ErrorState title="Chưa cấu hình API">
              Đặt EXPO_PUBLIC_API_BASE_URL để tải danh sách đã xuất bản. Không
              thay bằng catalog demo.
            </ErrorState>
          ) : null}
          {publishedPhase === 'error' && publishedError ? (
            <ErrorState
              title={eventsCopy.errorList.title}
              onRetry={retryPublished}
              retryLabel="Tải lại danh sách"
            >
              {publishedError}
            </ErrorState>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        publishedPhase === 'ready' ? (
          <EmptyState title={eventsCopy.emptyPublished.title}>
            {eventsCopy.emptyPublished.body}
          </EmptyState>
        ) : publishedPhase === 'loading' ||
          publishedPhase === 'error' ||
          publishedPhase === 'misconfigured' ? (
          <View />
        ) : (
          <EmptyState title={eventsCopy.emptyPublished.title}>
            {eventsCopy.emptyPublished.body}
          </EmptyState>
        )
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: 16,
            gap: 8,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderCurve: 'continuous',
            borderTopWidth: 4,
            borderTopColor: item.brand.primaryColor,
          }}
        >
          <EventMediaHeader
            eventId={item.id}
            tenantSlug={item.tenantSlug}
            bannerUrl={item.brand.bannerUrl}
            logoUrl={item.brand.logoUrl}
            testID={`pub-media-${item.id}`}
          />
          <Text selectable style={{ color: colors.secondary, fontSize: 13 }}>
            Đã xuất bản · v{item.publishedConfigVersion}
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
              : 'Chưa có giờ bắt đầu'}
          </Text>
          {item.location ? (
            <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
              {item.location}
            </Text>
          ) : null}
        </View>
      )}
      ListFooterComponent={
        showDemo ? (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Text
              selectable
              style={{ color: colors.secondary, fontWeight: '600' }}
            >
              Demo · dữ liệu mẫu (không phải nguồn đã xuất bản)
            </Text>
            <Text style={{ color: colors.secondary, ...typography.caption }}>
              Chỉ xem trên route /events/fixture/*. Không thay danh sách API khi
              lỗi hoặc trống.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Đổi tổ chức demo"
              onPress={() =>
                setDemoTenant(
                  demoTenant === demoTenants[0]
                    ? demoTenants[1]
                    : demoTenants[0],
                )
              }
              style={({ pressed }) => ({
                paddingVertical: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.accent, textAlign: 'center' }}>
                Đổi tổ chức demo · {demoTenant}
              </Text>
            </Pressable>
            {demoEvents.length === 0 ? (
              <EmptyState title={eventsCopy.emptyDemo.title}>
                {eventsCopy.emptyDemo.body}
              </EmptyState>
            ) : (
              demoEvents.map((item) => (
                <View
                  key={`demo:${item.tenantSlug}:${item.id}`}
                  style={{
                    padding: 16,
                    gap: 8,
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderCurve: 'continuous',
                    borderTopWidth: 4,
                    borderTopColor: item.brand.primaryColor,
                    opacity: 0.92,
                  }}
                >
                  <EventMediaHeader
                    eventId={item.id}
                    tenantSlug={item.tenantSlug}
                    testID={`demo-media-${item.id}`}
                  />
                  <Text
                    selectable
                    style={{ color: colors.secondary, fontSize: 13 }}
                  >
                    Demo · chưa xuất bản · fixture
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
                      fontSize: 20,
                      fontWeight: '600',
                      paddingVertical: 4,
                    }}
                  >
                    {item.name}
                  </Link>
                  <Text
                    selectable
                    style={{ color: colors.label, fontSize: 17 }}
                  >
                    {eventDate(item)}
                  </Text>
                  <Text
                    selectable
                    style={{ color: colors.secondary, fontSize: 17 }}
                  >
                    {item.location}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : undefined
      }
    />
  );
}
