import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AttendeeCta } from '@/components/attendee-cta';
import { EVENT_BANNER_HEIGHT_LIST } from '@/components/event-banner-metrics';
import { EventBanner } from '@/components/event-media';
import {
  EmptyState,
  ErrorState,
  LoadingState
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { fetchPlatformPublishedEventList } from '@/published/published-event-api';
import {
  initialPublishedListPhase,
  publishedListStateFromResult,
  type PublishedListPhase
} from '@/published/events-home';
import type { PublishedEventSummary } from '@/published/types';
import { isAppCatalogConfigured } from '@/identity/catalog-context';
import { session } from '@/identity/session';
import { staffEligibility } from '@/identity/staff-eligibility';
import { tryRestoreVerifiedSession } from '@/identity/session-restore-retry';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { useAttendeeTabBarInset } from '@/navigation/use-attendee-tab-bar-inset';
import { useShowAttendeeTabs } from '@/navigation/use-staff-workspace';
import { WalletOwnedTicketsLink } from '@/components/wallet-owned-tickets-link';
import { space, radius } from '@/theme/tokens';
import { typography } from '@/theme/typography';

function formatListDate(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('vi', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone
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
    <View
      style={{
        backgroundColor: colors.onAccent,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        overflow: 'hidden',
        marginBottom: space.lg
      }}
    >
      <Link
        href={{
          pathname: '/events/[tenantSlug]/[slug]',
          params: { tenantSlug: item.tenantSlug, slug: item.slug }
        }}
        asChild
      >
        <Pressable
          accessibilityRole="link"
          style={({ pressed }) => ({
            opacity: pressed ? 0.92 : 1
          })}
        >
          <EventBanner
            eventId={item.id}
            tenantSlug={item.tenantSlug}
            bannerUrl={item.brand.bannerUrl}
            fallbackColor={item.brand.primaryColor}
            wordmark={item.brand.organizationName}
            height={EVENT_BANNER_HEIGHT_LIST}
            style={{ borderRadius: 0 }}
            testID={`pub-media-${item.id}-banner`}
            accessibilityLabel={`Banner ${item.name}`}
          />
          <View style={{ padding: space.lg, gap: space.sm }}>
            <Text
              style={{ ...typography.caption, color: colors.secondary,
                fontFamily: fontFamilies.body }}
            >
              {item.brand.organizationName}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ ...typography.title, color: brand.ink,
                fontFamily: fontFamilies.display }}
            >
              {item.name}
            </Text>
            <Text
              style={{ ...typography.subhead, color: colors.secondary,
                fontFamily: fontFamilies.body }}
            >
              {dateLine}
              {item.location ? ` · ${item.location}` : ''}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: colors.admitSurface,
                borderRadius: radius.sm,
                paddingHorizontal: space.sm,
                paddingVertical: space.xs
              }}
            >
              <Text
                style={{ ...typography.badge, color: colors.admit,
                  fontFamily: fontFamilies.body }}
              >
                {eventsCopy.publishedStatusPill}
              </Text>
            </View>
            <WalletOwnedTicketsLink
              eventId={item.id}
              variant="card-row"
              testID={`pub-owned-tickets-${item.id}`}
            />
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

/**
 * Events home: platform published catalog (`GET /v1/public/events`).
 * Layout parity: large title «Sự kiện» (native) → search → cards → đổi mã CTA.
 */
export function EventsScreen() {
  const showAttendeeChrome = useShowAttendeeTabs();
  const tabBarInset = useAttendeeTabBarInset(56);
  const insets = useSafeAreaInsets();
  const { resetToDefault } = useTheme();
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
    void (async () => {
      const outcome = await tryRestoreVerifiedSession(session);
      if (outcome === 'verified' || outcome === 'already-verified') {
        void staffEligibility.refresh(session);
      }
      setReloadKey((key) => key + 1);
    })();
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
    resetToDefault();
  }, [resetToDefault]);

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
    <View style={{ gap: space.md, paddingBottom: space.xs }}>
      {showCatalogChrome ? (
        <Text
          maxFontSizeMultiplier={2}
          style={{ ...typography.subhead, color: colors.secondary,
            fontFamily: fontFamilies.body,
            lineHeight: 22 }}
        >
          {eventsCopy.heroSupport}
        </Text>
      ) : null}
      {showCatalogChrome ? (
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={eventsCopy.searchPlaceholder}
          accessibilityLabel={eventsCopy.searchAccessibilityLabel}
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={publishedPhase === 'ready'}
          style={styles.searchField}
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
      <View style={{ paddingTop: space.sm, paddingBottom: space.xxxl }}>
        <AttendeeCta
          label={eventsCopy.redeemCta}
          variant="secondary"
          onPress={() => router.push('/redeem-global')}
          testID="events-cta-redeem"
        />
      </View>
    ) : undefined;

  const bottomInset = tabBarInset;

  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        scrollIndicatorInsets={{ bottom: tabBarInset - insets.bottom }}
        style={{ flex: 1, backgroundColor: brand.paper }}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingTop: space.sm,
          paddingBottom: bottomInset,
          flexGrow: 1
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
    <AttendeeScreenChrome title={eventsCopy.listHeadline} />
    </>
  );
}

const styles = StyleSheet.create({
  searchField: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md
  }
});
