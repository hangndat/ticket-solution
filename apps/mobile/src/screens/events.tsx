import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import {
  demoTenants,
  eventDate,
  listDemoEvents,
} from '@/data/demo-events';
import { EventMediaHeader } from '@/components/event-media';
import { BrandWordmark } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StateCaption,
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { fetchPublishedEventList } from '@/published/published-event-api';
import type { PublishedEventSummary } from '@/published/types';
import { getApiBaseUrl } from '@/identity/config';
import { eventsHomeListSource } from '@/screens/events-home-source';
import { colors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';

const PUBLISHED_TENANTS = ['demo-fun', 'demo-studio'] as const;

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

type PublishedPhase = 'loading' | 'ready' | 'error' | 'misconfigured';

/**
 * Events home — published list is the primary FlatList source (ADR-19).
 * Demo catalog only appears in an explicit DEMO footer; never as silent fallback.
 */
export function EventsScreen() {
  const [publishedTenant, setPublishedTenant] = useState<string>(
    PUBLISHED_TENANTS[0],
  );
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <EventsHomeBody
      key={`events-home:${publishedTenant}:${reloadKey}`}
      publishedTenant={publishedTenant}
      onChangePublishedTenant={() =>
        setPublishedTenant((t) =>
          t === PUBLISHED_TENANTS[0]
            ? PUBLISHED_TENANTS[1]
            : PUBLISHED_TENANTS[0],
        )
      }
      onRetry={() => setReloadKey((k) => k + 1)}
    />
  );
}

function EventsHomeBody({
  publishedTenant,
  onChangePublishedTenant,
  onRetry,
}: {
  publishedTenant: string;
  onChangePublishedTenant: () => void;
  onRetry: () => void;
}) {
  const { applyBranding, theme } = useTheme();
  const [demoTenant, setDemoTenant] = useState<string>(demoTenants[0]);
  const [published, setPublished] = useState<PublishedEventSummary[]>([]);
  const [publishedPhase, setPublishedPhase] = useState<PublishedPhase>(() =>
    getApiBaseUrl() ? 'loading' : 'misconfigured',
  );
  const [publishedError, setPublishedError] = useState<string | null>(null);

  useEffect(() => {
    if (!getApiBaseUrl()) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      const result = await fetchPublishedEventList(
        publishedTenant,
        { limit: 20 },
        controller.signal,
      );
      if (cancelled) return;
      if (result.status === 'ok') {
        setPublished(result.body.items);
        setPublishedPhase('ready');
        setPublishedError(null);
        return;
      }
      // Fail-closed: clear list; do not substitute demo catalog.
      setPublished([]);
      setPublishedPhase('error');
      setPublishedError(
        result.status === 'misconfigured'
          ? 'Thiếu URL API'
          : 'Không tải được danh sách đã xuất bản — không dùng demo thay thế.',
      );
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [publishedTenant]);

  // Brand chrome from first published item when ready — never from demo as SoT.
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
  }, [publishedPhase, published, applyBranding]);

  const demoEvents = listDemoEvents(demoTenant);
  // Policy: FlatList data is published-only (or empty). Demo never substitutes.
  const listData =
    eventsHomeListSource(published.length) === 'published' ? published : [];

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
      data={listData}
      keyExtractor={(item) => `pub:${item.id}`}
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
            Danh sách từ máy chủ (đã xuất bản). Lỗi mạng không thay bằng demo.
          </Text>
          <Link href="/redeem" style={{ color: colors.accent, fontSize: 17 }}>
            Đổi mã
          </Link>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tổ chức đã xuất bản"
            onPress={onChangePublishedTenant}
            style={({ pressed }) => ({
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.label,
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              Đổi tổ chức: {publishedTenant}
            </Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <PublishedListEmpty
          phase={publishedPhase}
          error={publishedError}
          onRetry={onRetry}
        />
      }
      renderItem={({ item }) => (
        <View
          style={{
            padding: 16,
            gap: 8,
            backgroundColor: colors.card,
            borderRadius: 16,
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
        </View>
      )}
      ListFooterComponent={
        <DemoCatalogFooter
          demoTenant={demoTenant}
          demoEvents={demoEvents}
          onToggleDemoTenant={() =>
            setDemoTenant(
              demoTenant === demoTenants[0] ? demoTenants[1] : demoTenants[0],
            )
          }
        />
      }
    />
  );
}

function PublishedListEmpty({
  phase,
  error,
  onRetry,
}: {
  phase: PublishedPhase;
  error: string | null;
  onRetry: () => void;
}) {
  if (phase === 'loading') {
    return (
      <LoadingState title={eventsCopy.loadingList.title}>
        {eventsCopy.loadingList.body}
      </LoadingState>
    );
  }
  if (phase === 'misconfigured') {
    return (
      <ErrorState title="Chưa cấu hình API">
        Đặt EXPO_PUBLIC_API_BASE_URL. Không dùng catalog demo thay thế.
      </ErrorState>
    );
  }
  if (phase === 'error') {
    return (
      <ErrorState
        title={eventsCopy.errorList.title}
        onRetry={onRetry}
        retryLabel="Tải lại danh sách"
      >
        {error ?? 'Không tải được danh sách đã xuất bản.'}
      </ErrorState>
    );
  }
  // ready + empty
  return (
    <EmptyState title={eventsCopy.emptyPublished.title}>
      {eventsCopy.emptyPublished.body}
    </EmptyState>
  );
}

function DemoCatalogFooter({
  demoTenant,
  demoEvents,
  onToggleDemoTenant,
}: {
  demoTenant: string;
  demoEvents: ReturnType<typeof listDemoEvents>;
  onToggleDemoTenant: () => void;
}) {
  return (
    <View style={{ gap: 16, marginTop: 24 }}>
      <Text
        selectable
        style={{ color: colors.secondary, fontWeight: '600', fontSize: 15 }}
      >
        DEMO · catalog mẫu (không phải nguồn chính)
      </Text>
      <StateCaption>
        Chỉ mở qua nhãn DEMO / route fixture. Không thay danh sách đã xuất bản
        khi API lỗi.
      </StateCaption>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đổi tổ chức demo"
        onPress={onToggleDemoTenant}
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
          Đổi tổ chức demo: {demoTenant}
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
              padding: 20,
              gap: 12,
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
              testID={`demo-media-${item.id}`}
            />
            <Text selectable style={{ color: colors.secondary, fontSize: 13 }}>
              DEMO · chưa xuất bản
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
        ))
      )}
    </View>
  );
}
