import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { demoTenants, eventDate, listDemoEvents } from '@/data/demo-events';
import { AttendeeCta } from '@/components/attendee-cta';
import { EventMediaHeader } from '@/components/event-media';
import { BrandWordmark } from '@/components/page';
import { ScreenAtmosphere } from '@/components/screen-atmosphere';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { useAttendeeSignIn } from '@/attendee/use-attendee-sign-in';
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
import { session } from '@/identity/session';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
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
 * Events home (ADR-19 / #257 / UX-UI #475): published list is FlatList SoT.
 * Fixture catalog is footer-only with explicit Demo labels — never API fallback.
 * Brand hero + states per PD visual-notes priority screen 1.
 */
export function EventsScreen() {
  const { applyBranding, theme } = useTheme();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const { busy: signInBusy, error: signInError, configured, signIn } =
    useAttendeeSignIn();
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
  const [reduceMotionOs, setReduceMotionOs] = useState(false);
  const [heroOpacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (cancelled) return;
      setReduceMotionOs(enabled);
      if (!enabled) {
        heroOpacity.setValue(0);
        Animated.timing(heroOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionOs,
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [heroOpacity]);

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
  const signedOut =
    identity.status !== 'verified' && configured;

  const hero = (
    <View style={{ gap: 16 }}>
      <BrandWordmark />
      <Text
        accessibilityRole="header"
        style={{ color: brand.ink, ...typography.display }}
      >
        {eventsCopy.heroHeadline}
      </Text>
      <Text style={{ color: colors.secondary, ...typography.body }}>
        {eventsCopy.heroSupport}
      </Text>
      <View style={{ gap: 10 }}>
        <AttendeeCta
          label={eventsCopy.redeemCta}
          onPress={() => router.push('/redeem-global')}
          testID="events-cta-redeem"
        />
        {signedOut ? (
          <AttendeeCta
            label={signInBusy ? 'Đang đăng nhập…' : eventsCopy.signInCta}
            variant="secondary"
            disabled={signInBusy}
            onPress={() => void signIn()}
            testID="events-cta-signin"
          />
        ) : null}
      </View>
      {signInError ? (
        <ErrorState
          title="Không đăng nhập được"
          onRetry={() => void signIn()}
          retryLabel="Thử lại"
        >
          {signInError}
        </ErrorState>
      ) : null}
      <Text
        accessibilityLabel={`Tổ chức: ${publishedTenant}`}
        style={{ color: colors.secondary, ...typography.caption }}
        selectable
      >
        Tổ chức: {publishedTenant}
        {theme.organizationName ? ` · ${theme.organizationName}` : ''}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đổi tổ chức để tải danh sách đã xuất bản"
        onPress={switchPublishedTenant}
        style={({ pressed }) => ({
          minHeight: 44,
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
            fontFamily: fontFamilies.bodySemiBold,
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
          retryLabel="Thử lại"
        >
          {publishedError}
        </ErrorState>
      ) : null}
    </View>
  );

  return (
    <ScreenAtmosphere>
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
      data={listData}
      keyExtractor={(item) => `pub:${item.tenantSlug}:${item.id}`}
      ListHeaderComponent={
        <Animated.View style={{ opacity: reduceMotionOs ? 1 : heroOpacity }}>
          {hero}
        </Animated.View>
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
            paddingVertical: 16,
            gap: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.separator,
          }}
        >
          <EventMediaHeader
            eventId={item.id}
            tenantSlug={item.tenantSlug}
            bannerUrl={item.brand.bannerUrl}
            logoUrl={item.brand.logoUrl}
            testID={`pub-media-${item.id}`}
          />
          <Text selectable style={{ color: colors.secondary, fontSize: 13, fontFamily: fontFamilies.body }}>
            Đã xuất bản · v{item.publishedConfigVersion}
          </Text>
          <Text selectable style={{ color: colors.secondary, fontFamily: fontFamilies.body }}>
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
              fontFamily: fontFamilies.display,
              fontWeight: '600',
              paddingVertical: 4,
            }}
          >
            {item.name}
          </Link>
          <Text selectable style={{ color: colors.label, fontFamily: fontFamilies.body }}>
            {item.startsAt
              ? formatListDate(item.startsAt, item.timezone)
              : 'Chưa có giờ bắt đầu'}
          </Text>
          {item.location ? (
            <Text
              selectable
              style={{
                color: colors.secondary,
                fontSize: 17,
                fontFamily: fontFamilies.body,
              }}
            >
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
              style={{
                color: colors.secondary,
                fontWeight: '600',
                fontFamily: fontFamilies.bodySemiBold,
              }}
            >
              Demo · dữ liệu mẫu (không phải nguồn đã xuất bản)
            </Text>
            <Text style={{ color: colors.secondary, ...typography.caption }}>
              Chỉ xem nội dung mẫu cục bộ. Không thay danh sách đã xuất bản khi
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
                minHeight: 44,
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
                    paddingVertical: 16,
                    gap: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.separator,
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
                    Demo · chưa xuất bản · dữ liệu mẫu
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
    </ScreenAtmosphere>
  );
}
