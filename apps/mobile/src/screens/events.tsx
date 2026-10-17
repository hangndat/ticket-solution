import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { demoTenants, eventDate, listDemoEvents } from '@/data/demo-events';
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
import { colors } from '@/theme/colors';
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
        ? 'Thiếu URL API'
        : 'Không tải được danh sách đã xuất bản — không dùng demo thay thế.',
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
          <BrandWordmark />
          <Text style={{ color: colors.label, ...typography.title }}>
            Tìm sự kiện tiếp theo
          </Text>
          <Text style={{ color: colors.secondary, ...typography.body }}>
            Đổi mã để nhận vé. Mục demo bên dưới chỉ là dữ liệu mẫu.
          </Text>
          <Link href="/redeem" style={{ color: colors.accent, fontSize: 17 }}>
            Đổi mã
          </Link>

          <Text style={{ color: colors.secondary, fontWeight: '600', marginTop: 4 }}>
            Sự kiện đã xuất bản
          </Text>
          <Text selectable style={{ color: colors.secondary, ...typography.caption }}>
            Tenant: {publishedTenant}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải danh sách sự kiện đã xuất bản"
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
                color: colors.onAccent,
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {publishedPhase === 'loading'
                ? 'Đang tải…'
                : 'Tải danh sách đã xuất bản'}
            </Text>
          </Pressable>
          {publishedPhase === 'loading' ? (
            <LoadingState title={eventsCopy.loadingList.title}>
              {eventsCopy.loadingList.body}
            </LoadingState>
          ) : null}
          {publishedPhase === 'misconfigured' ? (
            <ErrorState title="Chưa cấu hình API">
              Đặt EXPO_PUBLIC_API_BASE_URL. Demo vẫn chỉ là mẫu.
            </ErrorState>
          ) : null}
          {publishedPhase === 'idle' ? (
            <StateCaption>Chạm nút trên để gọi API công khai.</StateCaption>
          ) : null}
          {publishedPhase === 'error' && publishedError ? (
            <ErrorState
              title={eventsCopy.errorList.title}
              onRetry={() => void loadPublished()}
              retryLabel="Tải lại danh sách"
            >
              {publishedError}
            </ErrorState>
          ) : null}
          {publishedPhase === 'ready' && published.length === 0 ? (
            <EmptyState title={eventsCopy.emptyPublished.title}>
              {eventsCopy.emptyPublished.body}
            </EmptyState>
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
          ))}

          <Text
            selectable
            style={{ color: colors.secondary, marginTop: 8, fontWeight: '600' }}
          >
            Demo · Tổ chức: {tenant}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tổ chức demo"
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
              Đổi tổ chức demo
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi tenant slug để thử API đã xuất bản"
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
              Đổi tenant slug (thử API)
            </Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <EmptyState title={eventsCopy.emptyDemo.title}>
          {eventsCopy.emptyDemo.body}
        </EmptyState>
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
            Demo · chưa xuất bản
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
