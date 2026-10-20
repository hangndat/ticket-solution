import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { AttendeeCta } from '@/components/attendee-cta';
import { EventMediaHeader } from '@/components/event-media';
import { BrandWordmark } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { fetchPlatformPublishedEventList } from '@/published/published-event-api';
import {
  initialPublishedListPhase,
  publishedListStateFromResult,
  type PublishedListPhase,
} from '@/published/events-home';
import type { PublishedEventSummary } from '@/published/types';
import { isAppCatalogConfigured } from '@/identity/catalog-context';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { useShowAttendeeTabs } from '@/navigation/use-staff-workspace';

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
 * Events home: platform published catalog (`GET /v1/public/events`).
 */
export function EventsScreen() {
  const showAttendeeChrome = useShowAttendeeTabs();
  const { applyBranding, theme } = useTheme();
  const [published, setPublished] = useState<PublishedEventSummary[]>([]);
  const [publishedPhase, setPublishedPhase] = useState<PublishedListPhase>(() =>
    initialPublishedListPhase(isAppCatalogConfigured()),
  );
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
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

  const retryPublished = () => {
    setPublishedPhase('loading');
    setPublishedError(null);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      if (!isAppCatalogConfigured()) {
        if (cancelled) return;
        setPublished([]);
        setPublishedPhase('misconfigured');
        setPublishedError(eventsCopy.misconfiguredBody);
        return;
      }
      const result = await fetchPlatformPublishedEventList(
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
  }, [reloadKey]);

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

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
  const listData =
    publishedPhase === 'ready'
      ? published.filter((item) => {
          if (!normalizedQuery) return true;
          const haystack = [
            item.name,
            item.brand.organizationName,
            item.location ?? '',
          ]
            .join(' ')
            .toLocaleLowerCase('vi');
          return haystack.includes(normalizedQuery);
        })
      : ([] as PublishedEventSummary[]);

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
      {publishedPhase === 'ready' && published.length > 0 ? (
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={eventsCopy.searchPlaceholder}
          accessibilityLabel={eventsCopy.searchAccessibilityLabel}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{
            backgroundColor: colors.card,
            borderRadius: 11,
            paddingHorizontal: 14,
            paddingVertical: 12,
            minHeight: 48,
            fontFamily: fontFamilies.body,
            fontSize: 17,
            color: brand.ink,
          }}
          testID="events-search"
        />
      ) : null}
      {showAttendeeChrome ? (
        <AttendeeCta
          label={eventsCopy.redeemCta}
          onPress={() => router.push('/redeem-global')}
          testID="events-cta-redeem"
        />
      ) : null}
      {theme.organizationName ? (
        <Text
          accessibilityLabel={`Tổ chức: ${theme.organizationName}`}
          style={{ color: colors.secondary, ...typography.caption }}
        >
          {theme.organizationName}
        </Text>
      ) : null}

      {publishedPhase === 'loading' ? (
        <LoadingState title={eventsCopy.loadingList.title}>
          {eventsCopy.loadingList.body}
        </LoadingState>
      ) : null}
      {publishedPhase === 'misconfigured' ? (
        <ErrorState title={eventsCopy.misconfiguredTitle}>
          {publishedError ?? eventsCopy.misconfiguredBody}
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
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.paper }}
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
            normalizedQuery ? (
              <EmptyState title="Không có kết quả">
                Thử từ khóa khác hoặc xóa ô tìm kiếm.
              </EmptyState>
            ) : (
              <EmptyState title={eventsCopy.emptyPublished.title}>
                {eventsCopy.emptyPublished.body}
              </EmptyState>
            )
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
            <Text
              selectable
              style={{
                color: colors.secondary,
                fontSize: 13,
                fontFamily: fontFamilies.body,
              }}
            >
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
            <Text
              selectable
              style={{ color: colors.label, fontFamily: fontFamilies.body }}
            >
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
      />
      <TabStackTitle title="Sự kiện" />
    </>
  );
}
