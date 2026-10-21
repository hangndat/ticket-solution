import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AttendeeCta } from '@/components/attendee-cta';
import { EventBanner, EventLogo } from '@/components/event-media';
import { BrandWordmark, Notice, Page } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy, redeemCopy } from '@/components/screen-state-copy';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import {
  fetchPublishedEventDetail,
  visibleSectionsInOrder,
} from '@/published/published-event-api';
import type { PublishedEventDetail } from '@/published/types';
import { brand, colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { typography } from '@/theme/typography';
import { WalletOwnedTicketsLink } from '@/components/wallet-owned-tickets-link';

export function EventDetailScreen({
  tenantSlug,
  slug,
  fixture = false,
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

  return { heroOpacity, reduceMotionOs };
}

function FixtureDemoDetail({
  tenantSlug,
  slug,
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
        wordmark: event.brand.organizationName,
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
    <Page>
      <Animated.View
        style={{
          opacity: reduceMotionOs ? 1 : heroOpacity,
          gap: 16,
        }}
      >
        <Text
          style={{
            color: brand.signal,
            fontFamily: fontFamilies.bodySemiBold,
            fontSize: 13,
            fontWeight: '600',
          }}
        >
          Demo · dữ liệu mẫu · chưa xuất bản
        </Text>
        <BrandWordmark compact />
        <EventBanner
          eventId={event.id}
          tenantSlug={event.tenantSlug}
          height={200}
          style={{ marginHorizontal: -20, borderRadius: 0, width: undefined }}
          testID={`fixture-banner-${event.id}`}
        />
        <Text
          accessibilityRole="header"
          selectable
          style={{ color: brand.ink, ...typography.display }}
        >
          {event.name}
        </Text>
        <Text
          selectable
          style={{ color: colors.secondary, ...typography.body }}
        >
          {[eventDate(event), event.location].filter(Boolean).join(' · ')}
        </Text>
        <Notice title="Đăng ký">
          Chỉ thông tin mẫu. Không đăng ký vé từ dữ liệu demo.
        </Notice>
      </Animated.View>
    </Page>
  );
}

function PublishedEventDetailView({
  tenantSlug,
  slug,
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
            : 'Không tải được sự kiện. Phản hồi không hợp lệ.',
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

/** Live Pulse composition — media plane + typography stack; no thick floating card. */
function PublishedEventComposition({
  event,
}: {
  event: PublishedEventDetail;
}) {
  const { applyBranding } = useTheme();
  const { heroOpacity, reduceMotionOs } = useHeroFade();
  const sections = visibleSectionsInOrder(event);
  const dateLine = event.startsAt
    ? formatPublishedDate(event.startsAt, event.timezone)
    : null;
  const locationLine = event.location?.trim() || null;
  const orgLine = event.brand.organizationName?.trim() || null;

  useEffect(() => {
    applyBranding(
      {
        tenantSlug: event.tenantSlug,
        organizationName: event.brand.organizationName,
        primaryColor: event.brand.primaryColor,
        logoUrl: event.brand.logoUrl,
        wordmark: event.brand.organizationName,
      },
      'api',
    );
  }, [applyBranding, event]);

  return (
    <Page>
      <Animated.View
        style={{
          opacity: reduceMotionOs ? 1 : heroOpacity,
          gap: 16,
        }}
      >
        <EventBanner
          eventId={event.id}
          tenantSlug={event.tenantSlug}
          bannerUrl={event.brand.bannerUrl}
          height={220}
          style={{ marginHorizontal: -20, borderRadius: 0, width: undefined }}
          testID={`pub-detail-banner-${event.id}`}
        />

        {event.brand.logoUrl || event.brand.organizationName ? (
          <EventLogo
            eventId={event.id}
            tenantSlug={event.tenantSlug}
            logoUrl={event.brand.logoUrl}
            testID={`pub-detail-logo-${event.id}`}
          />
        ) : null}

        <Text
          accessibilityRole="header"
          selectable
          style={{ color: brand.ink, ...typography.display }}
        >
          {event.name}
        </Text>

        <PublishedEventMetadataGroup
          dateLine={dateLine}
          locationLine={locationLine}
          orgLine={orgLine}
        />

        <WalletOwnedTicketsLink
          eventId={event.id}
          variant="card-row"
          testID="event-detail-owned-tickets"
        />

        <View style={{ gap: 10 }}>
          <Text
            style={{
              color: brand.ink,
              fontFamily: fontFamilies.bodySemiBold,
              fontSize: 17,
              fontWeight: '600',
            }}
          >
            {redeemCopy.eventDetailRedeemBlockTitle}
          </Text>
          <AttendeeCta
            label={eventsCopy.redeemCta}
            onPress={() => router.push('/redeem-global')}
            testID="event-detail-cta-redeem"
          />
        </View>
      </Animated.View>

      {event.brand.contact ? (
        <Text
          selectable
          style={{ color: colors.secondary, ...typography.callout }}
        >
          {event.brand.contact}
        </Text>
      ) : null}

      {sections.map((section) => (
        <Notice key={section.id} title={section.title ?? section.kind}>
          {section.bodyMarkdown?.trim() || `(${section.kind})`}
        </Notice>
      ))}

      {event.faq.length > 0 ? (
        <Notice title="Câu hỏi thường gặp">
          {event.faq.map((item, index) => (
            <Text
              key={`${item.q}-${index}`}
              selectable
              style={{
                marginBottom: 8,
                color: colors.label,
                fontFamily: fontFamilies.body,
                fontSize: 17,
                lineHeight: 25,
              }}
            >
              H: {item.q}
              {'\n'}
              Đ: {item.a}
            </Text>
          ))}
        </Notice>
      ) : null}

      {event.terms ? (
        <Notice title={`Điều khoản (${event.terms.version})`}>
          {event.terms.bodyMarkdown}
        </Notice>
      ) : null}

      <AttendeeCta
        label="Tất cả sự kiện"
        variant="secondary"
        onPress={() => router.replace('/')}
        testID="event-detail-all-events"
      />
    </Page>
  );
}

function PublishedEventMetadataGroup({
  dateLine,
  locationLine,
  orgLine,
}: {
  dateLine: string | null;
  locationLine: string | null;
  orgLine: string | null;
}) {
  const rows = [
    dateLine ? { label: 'Ngày', value: dateLine } : null,
    locationLine ? { label: 'Địa điểm', value: locationLine } : null,
    orgLine ? { label: 'Đơn vị tổ chức', value: orgLine } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  if (rows.length === 0) {
    return (
      <Text selectable style={{ color: colors.secondary, ...typography.body }}>
        Chưa có giờ bắt đầu trên nội dung đã xuất bản
      </Text>
    );
  }

  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderCurve: 'continuous',
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            gap: 4,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: '#e8ecf1',
          }}
        >
          <Text
            style={{
              color: colors.secondary,
              fontSize: 13,
              fontFamily: fontFamilies.body,
            }}
          >
            {row.label}
          </Text>
          <Text
            selectable
            style={{
              color: brand.ink,
              fontSize: 17,
              fontFamily: fontFamilies.body,
            }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function formatPublishedDate(startsAt: string, timezone: string): string {
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
