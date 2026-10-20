import { useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttendeeCta } from '@/components/attendee-cta';
import { EventBanner } from '@/components/event-media';
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
import { TabStackTitle } from '@/navigation/tab-stack-title';
import { useShowAttendeeTabs } from '@/navigation/use-staff-workspace';

/** Native tab bar + home indicator — keep list footer/cards above chrome. */
const TAB_BAR_CLEARANCE = 132;

function formatListDate(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('vi', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

function PublishedEventCard({ item }: { item: PublishedEventSummary }) {
  const dateLine = item.startsAt
    ? formatListDate(item.startsAt, item.timezone)
    : 'Chưa có giờ bắt đầu';

  return (
    <Link
      href={{
        pathname: '/events/[tenantSlug]/[slug]',
        params: { tenantSlug: item.tenantSlug, slug: item.slug },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
          marginBottom: 18,
        })}
      >
        <EventBanner
          eventId={item.id}
          tenantSlug={item.tenantSlug}
          bannerUrl={item.brand.bannerUrl}
          height={142}
          style={{ borderRadius: 0 }}
          testID={`pub-media-${item.id}-banner`}
        />
        <View style={{ padding: 15, gap: 8 }}>
          <Text
            style={{
              color: colors.secondary,
              fontSize: 13,
              fontFamily: fontFamilies.body,
            }}
          >
            {item.brand.organizationName}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              color: brand.ink,
              fontSize: 22,
              fontFamily: fontFamilies.display,
              fontWeight: '600',
            }}
          >
            {item.name}
          </Text>
          <Text
            style={{
              color: colors.secondary,
              fontSize: 15,
              fontFamily: fontFamilies.body,
            }}
          >
            {dateLine}
            {item.location ? ` · ${item.location}` : ''}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#edf5ef',
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                color: '#26734c',
                fontSize: 11,
                fontFamily: fontFamilies.body,
                fontWeight: '600',
              }}
            >
              {eventsCopy.publishedStatusPill}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * Events home: platform published catalog (`GET /v1/public/events`).
 * Layout parity: large title «Sự kiện» (native) → search → cards → đổi mã CTA.
 */
export function EventsScreen() {
  const showAttendeeChrome = useShowAttendeeTabs();
  const insets = useSafeAreaInsets();
  const { applyBranding } = useTheme();
  const [published, setPublished] = useState<PublishedEventSummary[]>([]);
  const [publishedPhase, setPublishedPhase] = useState<PublishedListPhase>(() =>
    initialPublishedListPhase(isAppCatalogConfigured()),
  );
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

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

  const showCatalogChrome =
    publishedPhase === 'ready' || publishedPhase === 'loading';

  const listHeader = (
    <View style={{ gap: 12, paddingBottom: 4 }}>
      {showCatalogChrome ? (
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={eventsCopy.searchPlaceholder}
          accessibilityLabel={eventsCopy.searchAccessibilityLabel}
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={publishedPhase === 'ready'}
          style={{
            backgroundColor: '#e8ecf1',
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

  const listFooter =
    showAttendeeChrome && publishedPhase === 'ready' ? (
      <View style={{ paddingTop: 8, paddingBottom: 20 }}>
        <AttendeeCta
          label={eventsCopy.redeemCta}
          variant="secondary"
          onPress={() => router.push('/redeem-global')}
          testID="events-cta-redeem"
        />
      </View>
    ) : undefined;

  const bottomInset = insets.bottom + TAB_BAR_CLEARANCE;

  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: bottomInset,
          flexGrow: 1,
        }}
        data={listData}
        keyExtractor={(item) => `pub:${item.tenantSlug}:${item.id}`}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
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
        renderItem={({ item }) => <PublishedEventCard item={item} />}
      />
      <TabStackTitle title="Sự kiện" large={false} />
    </>
  );
}
