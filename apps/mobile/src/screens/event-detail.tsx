import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Text,
  View
} from 'react-native';
import { router } from 'expo-router';
import { AttendeeCta } from '@/components/attendee-cta';
import { EVENT_BANNER_HEIGHT_DETAIL } from '@/components/event-banner-metrics';
import {
  CollapsibleRow,
  EventDetailBody,
  EventDetailLayout,
  EventMeta,
  ExpandableText,
  SectionBlock
} from '@/components/event-detail-blocks';
import { EventBanner } from '@/components/event-media';
import { Page } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { ATTENDEE_REDEEM_PATH } from '@/navigation/attendee-redeem-entry';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import { buildEventDetailModel } from '@/published/event-detail-model';
import {
  fetchPublishedEventDetail
} from '@/published/published-event-api';
import type { PublishedEventDetail } from '@/published/types';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { WalletOwnedTicketsLink } from '@/components/wallet-owned-tickets-link';
import { space } from '@/theme/tokens';

export function EventDetailScreen({
  tenantSlug,
  slug,
  fixture = false
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

function useHeroFade() {
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
          useNativeDriver: true
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

  return { heroOpacity, reduceMotionOs };
}

function FixtureDemoDetail({
  tenantSlug,
  slug
}: {
  tenantSlug: string;
  slug: string;
}) {
  const { applyBranding } = useTheme();
  const { heroOpacity, reduceMotionOs } = useHeroFade();
  const event = findDemoEvent(tenantSlug, slug);

  useEffect(() => {
    if (!event) return;
    applyBranding(
      {
        tenantSlug: event.tenantSlug,
        organizationName: event.brand.organizationName,
        primaryColor: event.brand.primaryColor,
        wordmark: event.brand.organizationName
      },
      'api',
    );
  }, [applyBranding, event]);

  if (!event) {
    return (
      <Page>
        <EmptyState title="Không có trong catalog demo">
          Id này không khớp sự kiện mẫu. Liên kết không tải sự kiện đã xuất bản
          và không phải nội dung M04 chung.
        </EmptyState>
      </Page>
    );
  }
  return (
    <EventDetailLayout>
      <Animated.View
        style={{ opacity: reduceMotionOs ? 1 : heroOpacity, gap: space.lg }}
      >
        <EventBanner
          eventId={event.id}
          tenantSlug={event.tenantSlug}
          wordmark={event.name}
          height={EVENT_BANNER_HEIGHT_DETAIL}
          style={{ borderRadius: 0, width: undefined }}
          testID={`fixture-banner-${event.id}`}
          accessibilityLabel={`Banner ${event.name}`}
        />
        <EventDetailBody>
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              selectable
              style={{ color: brand.ink, ...typography.display }}
            >
              {event.name}
            </Text>
            <EventMeta
              whenLine={eventDate(event) || null}
              venue={event.location || null}
              organizer={null}
            />
          </View>
          <Text
            selectable
            style={{ ...typography.callout, color: colors.secondary }}
          >
            {eventsCopy.detail.fixtureNote}
          </Text>
        </EventDetailBody>
      </Animated.View>
    </EventDetailLayout>
  );
}

function PublishedEventDetailView({
  tenantSlug,
  slug
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
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      setPhase({ kind: 'loading' });
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
            ? 'Không tải được sự kiện. Kiểm tra kết nối rồi thử lại.'
            : 'Không tải được sự kiện. Phản hồi không hợp lệ.'
      });
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantSlug, slug, retryKey]);

  if (phase.kind === 'loading') {
    return (
      <Page>
        <LoadingState title={eventsCopy.loadingDetail.title}>
          {eventsCopy.loadingDetail.body}
        </LoadingState>
      </Page>
    );
  }

  if (phase.kind === 'misconfigured') {
    return (
      <Page>
        <ErrorState title="Chưa cấu hình API">
          Bản dựng chưa có địa chỉ API để tải sự kiện đã xuất bản. Demo mẫu
          không thay thế ở đây.
        </ErrorState>
      </Page>
    );
  }

  if (phase.kind === 'not-found') {
    return (
      <Page>
        <EmptyState title="Sự kiện không khả dụng">
          Sự kiện này không khả dụng hoặc chưa được xuất bản. Đây không phải
          nội dung demo.
        </EmptyState>
        <AttendeeCta
          label="Về danh sách sự kiện"
          variant="secondary"
          onPress={() => router.replace('/')}
          testID="event-detail-home"
        />
      </Page>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Page>
        <ErrorState
          title={eventsCopy.errorDetail.title}
          onRetry={() => setRetryKey((k) => k + 1)}
          retryLabel="Thử lại"
        >
          {phase.message}
        </ErrorState>
      </Page>
    );
  }

  return <PublishedEventComposition event={phase.event} />;
}

/** Published detail: banner → title + meta → about → quiet rows; pinned action bar. */
function PublishedEventComposition({
  event
}: {
  event: PublishedEventDetail;
}) {
  const { applyBranding } = useTheme();
  const { heroOpacity, reduceMotionOs } = useHeroFade();
  const model = buildEventDetailModel(event);
  const copy = eventsCopy.detail;

  useEffect(() => {
    applyBranding(
      {
        tenantSlug: event.tenantSlug,
        organizationName: event.brand.organizationName,
        primaryColor: event.brand.primaryColor,
        logoUrl: event.brand.logoUrl,
        wordmark: event.brand.organizationName
      },
      'api',
    );
  }, [applyBranding, event]);

  const footer = (
    <>
      <WalletOwnedTicketsLink
        eventId={event.id}
        variant="card-row"
        testID="event-detail-owned-tickets"
      />
      {model.redeemHint ? (
        <Text
          selectable
          numberOfLines={2}
          style={{ ...typography.callout, color: colors.secondary }}
        >
          {model.redeemHint}
        </Text>
      ) : null}
      <AttendeeCta
        label={eventsCopy.redeemCta}
        accessibilityLabel={`${eventsCopy.redeemCta} — nhận vé cho ${event.name}`}
        onPress={() => router.push(ATTENDEE_REDEEM_PATH)}
        testID="event-detail-cta-redeem"
      />
    </>
  );

  const hasRows = model.guide || model.faq.length > 0 || model.terms;

  return (
    <EventDetailLayout footer={footer}>
      <Animated.View
        style={{ opacity: reduceMotionOs ? 1 : heroOpacity, gap: space.xl }}
      >
        <EventBanner
          eventId={event.id}
          tenantSlug={event.tenantSlug}
          bannerUrl={event.brand.bannerUrl}
          fallbackColor={event.brand.primaryColor}
          wordmark={event.brand.organizationName}
          height={EVENT_BANNER_HEIGHT_DETAIL}
          style={{ borderRadius: 0, width: undefined }}
          testID={`pub-detail-banner-${event.id}`}
          accessibilityLabel={`Banner ${event.name}`}
        />
        <EventDetailBody>
          <View style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              selectable
              style={{ color: brand.ink, ...typography.display }}
            >
              {model.title}
            </Text>
            <EventMeta
              whenLine={model.whenLine}
              venue={model.venue}
              organizer={model.organizer}
            />
          </View>

          {model.about ? (
            <SectionBlock title={copy.aboutTitle}>
              <ExpandableText text={model.about} testID="event-detail-about" />
            </SectionBlock>
          ) : null}

          {hasRows ? (
            <View>
              {model.guide ? (
                <CollapsibleRow title={copy.guideTitle}>
                  <ExpandableText text={model.guide} />
                </CollapsibleRow>
              ) : null}
              {model.faq.length > 0 ? (
                <CollapsibleRow title={copy.faqTitle}>
                  {model.faq.map((item, index) => (
                    <View key={`${item.q}-${index}`} style={{ gap: space.xs }}>
                      <Text
                        selectable
                        style={{
                          ...typography.body,
                          color: brand.ink,
                          fontFamily: fontFamilies.bodySemiBold
                        }}
                      >
                        {item.q}
                      </Text>
                      <Text
                        selectable
                        style={{
                          ...typography.body,
                          color: colors.secondary,
                          fontFamily: fontFamilies.body
                        }}
                      >
                        {item.a}
                      </Text>
                    </View>
                  ))}
                </CollapsibleRow>
              ) : null}
              {model.terms ? (
                <CollapsibleRow
                  title={copy.termsTitle}
                  hint={model.terms.version ? `phiên bản ${model.terms.version}` : null}
                  testID="event-detail-terms"
                >
                  <ExpandableText text={model.terms.body} />
                </CollapsibleRow>
              ) : null}
            </View>
          ) : null}

          {model.contact ? (
            <Text
              selectable
              accessibilityLabel={`${copy.contactLabel}: ${model.contact}`}
              style={{ ...typography.callout, color: colors.secondary }}
            >
              {copy.contactLabel}: {model.contact}
            </Text>
          ) : null}
        </EventDetailBody>
      </Animated.View>
    </EventDetailLayout>
  );
}
