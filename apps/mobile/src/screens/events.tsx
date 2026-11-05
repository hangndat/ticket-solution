import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EVENT_BANNER_HEIGHT_LIST } from '@/components/event-banner-metrics';
import { EventBanner } from '@/components/event-media';
import { ErrorState, LoadingState } from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { AttendeeScreenChrome } from '@/navigation/attendee-screen-chrome';
import { fetchPlatformPublishedEventList } from '@/published/published-event-api';
import {
  initialPublishedListPhase,
  featuredCatalogHeading,
  nextCatalogRefreshMs,
  publishedListStateFromResult,
  selectPublishedCatalog,
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

function PublishedEventCard({ item, featured }: { item: PublishedEventSummary; featured: boolean }) {
  const dateLine = item.startsAt
    ? formatListDate(item.startsAt, item.timezone)
    : 'Chưa có giờ bắt đầu';

  const dateBadge = (() => {
    if (!item.startsAt) return null;
    const date = new Date(item.startsAt);
    if (Number.isNaN(date.getTime())) return null;
    try {
      return {
        day: new Intl.DateTimeFormat('vi', { day: '2-digit', timeZone: item.timezone }).format(date),
        month: new Intl.DateTimeFormat('vi', { month: 'short', timeZone: item.timezone }).format(date).toUpperCase()
      };
    } catch { return null; }
  })();

  return (
    <View
      style={{
        backgroundColor: colors.onAccent,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        overflow: 'hidden',
        marginBottom: featured ? space.lg : 0,
        borderWidth: 1,
        borderColor: colors.line
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
          accessibilityLabel={`Xem sự kiện ${item.name}`}
          testID={featured ? `pub-feature-${item.id}` : `pub-row-${item.id}`}
          style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
        >
          <View style={{
            flexDirection: featured ? 'column' : 'row',
            alignItems: featured ? 'stretch' : 'center',
            gap: featured ? 0 : space.md,
            padding: featured ? 0 : space.sm
          }}>
          <View style={{ width: featured ? '100%' : 52 }}>
            <EventBanner
              eventId={item.id}
              tenantSlug={item.tenantSlug}
              bannerUrl={item.brand.bannerUrl}
              fallbackColor={item.brand.primaryColor}
              wordmark={item.name}
              height={featured ? EVENT_BANNER_HEIGHT_LIST : 52}
              style={{ borderRadius: featured ? 0 : radius.sm }}
              testID={`pub-media-${item.id}-banner`}
              accessibilityLabel={`Banner ${item.name}`}
            />
            {featured && dateBadge ? (
              <View style={{ position: 'absolute', top: space.sm, left: space.sm,
                padding: space.xs, borderRadius: radius.sm,
                backgroundColor: colors.onAccent, alignItems: 'center' }}>
                <Text style={{ ...typography.title, color: brand.ink }}>{dateBadge.day}</Text>
                <Text style={{ ...typography.caption, color: colors.secondary }}>{dateBadge.month}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ flex: 1, padding: featured ? space.lg : 0, gap: space.xs }}>
            {featured ? <Text
              style={{ ...typography.caption, color: colors.secondary,
                fontFamily: fontFamilies.body }}
            >
              {item.brand.organizationName}
            </Text> : null}
            <Text
              accessibilityRole="header"
              numberOfLines={featured ? undefined : 1}
              style={{ ...(featured ? typography.title : typography.subheadSemibold), color: brand.ink,
                fontFamily: fontFamilies.display }}
            >
              {item.name}
            </Text>
            <Text
              numberOfLines={featured ? undefined : 1}
              style={{ ...typography.subhead, color: colors.secondary,
                fontFamily: fontFamilies.body }}
            >
              {dateLine}
              {item.location ? ` · ${item.location}` : ''}
            </Text>
            {featured ? <View style={{ borderTopWidth: 1, borderTopColor: colors.line,
              paddingTop: space.md, marginTop: space.sm, flexDirection: 'row',
              justifyContent: 'space-between' }}>
              <Text style={{ ...typography.subheadSemibold, color: brand.primary }}>Xem sự kiện</Text>
              <Text style={{ ...typography.subheadSemibold, color: brand.primary }}>→</Text>
            </View> : null}
          </View>
          {!featured ? <Text style={{ ...typography.title, color: colors.secondary }}>›</Text> : null}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

/**
 * Events home: platform published catalog (`GET /v1/public/events`).
 * Layout parity: large title «Sự kiện» (native) → search → cards. Đổi mã is its own tab.
 */
export function EventsScreen() {
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
  const [catalogNow, setCatalogNow] = useState(() => Date.now());

  const retryPublished = () => {
    setCatalogNow(Date.now());
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
      setCatalogNow(Date.now());
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
    if (publishedPhase !== 'ready') return;
    const delay = nextCatalogRefreshMs(published, catalogNow);
    if (delay === null) return;
    const timer = setTimeout(() => setCatalogNow(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [published, publishedPhase, catalogNow]);

  useEffect(() => {
    resetToDefault();
  }, [resetToDefault]);

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('vi');
  const listData = publishedPhase === 'ready'
    ? selectPublishedCatalog(published, searchQuery, catalogNow).matches
    : ([] as PublishedEventSummary[]);

  const showCatalogChrome =
    publishedPhase === 'ready' || publishedPhase === 'loading';

  const featured = listData[0];
  const otherEvents = listData.slice(1);
  const listHeader = (
    <View style={{ gap: space.md, paddingBottom: space.xs }}>
      {showCatalogChrome ? (
        <Text
          maxFontSizeMultiplier={2}
          style={{ ...typography.subhead, color: colors.secondary,
            fontFamily: fontFamilies.body,
            lineHeight: 22 }}
        >
          Tìm trải nghiệm tiếp theo của bạn
        </Text>
      ) : null}
      {showCatalogChrome ? (
        <Input
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm sự kiện, địa điểm..."
          accessibilityLabel="Tìm sự kiện, địa điểm"
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={publishedPhase === 'ready'}
          style={{ backgroundColor: colors.onAccent, borderRadius: radius.md,
            borderWidth: 1, borderColor: colors.line }}
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
      {featured ? (
        <>
          <Text accessibilityRole="header" style={{ ...typography.subheadSemibold,
            color: brand.ink }}>
            {featuredCatalogHeading(featured, normalizedQuery, catalogNow)}
          </Text>
          <PublishedEventCard item={featured} featured />
          {otherEvents.length > 0 ? (
            <Text accessibilityRole="header" style={{ ...typography.subheadSemibold,
              color: brand.ink }}>Các sự kiện khác</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

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
        data={otherEvents}
        keyExtractor={(item) => `pub:${item.tenantSlug}:${item.id}`}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={publishedPhase === 'ready' && !featured ? (
          <View style={{ alignItems: 'center', justifyContent: 'center',
            paddingVertical: space.huge, gap: space.md }}>
            <Text style={{ ...typography.display, color: brand.primary }}>✧</Text>
            <Text accessibilityRole="header" style={{ ...typography.title,
              color: brand.ink, textAlign: 'center' }}>
              {normalizedQuery ? 'Không có kết quả' : 'Chưa có sự kiện'}
            </Text>
            <Text style={{ ...typography.body, color: colors.secondary,
              textAlign: 'center' }}>
              {normalizedQuery
                ? 'Thử từ khóa khác hoặc xóa ô tìm kiếm trong 20 sự kiện đã tải.'
                : 'Khi có sự kiện mới, bạn sẽ thấy ở đây.'}
            </Text>
            {!normalizedQuery ? <Button label="Làm mới" variant="secondary"
              onPress={retryPublished} testID="events-empty-refresh" /> : null}
          </View>
        ) : undefined}
        renderItem={({ item }) => <PublishedEventCard item={item} featured={false} />}
        ListFooterComponent={publishedPhase === 'ready' && listData.length > 0 ? (
          <Text style={{ ...typography.caption, color: colors.secondary,
            paddingTop: space.md, textAlign: 'center' }}>
            Tìm kiếm trong 20 sự kiện đã tải.
          </Text>
        ) : undefined}
      />
    <AttendeeScreenChrome title={eventsCopy.listHeadline} />
    </>
  );
}
