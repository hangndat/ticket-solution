import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { EventMediaHeader } from '@/components/event-media';
import { Page, Notice } from '@/components/page';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/screen-state';
import { eventsCopy } from '@/components/screen-state-copy';
import { eventDate, findDemoEvent } from '@/data/demo-events';
import {
  fetchPublishedEventDetail,
  visibleSectionsInOrder,
} from '@/published/published-event-api';
import type { PublishedEventDetail } from '@/published/types';
import { colors } from '@/theme/colors';
import { useTheme } from '@/theme/ThemeProvider';

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

function FixtureDemoDetail({
  tenantSlug,
  slug,
}: {
  tenantSlug: string;
  slug: string;
}) {
  const { applyBranding } = useTheme();
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
      <Notice title="Demo · dữ liệu mẫu · chưa xuất bản">
        Nội dung mẫu tường minh trên thiết bị. Không phải sự kiện đã xuất bản
        trên máy chủ và không phải fallback khi API lỗi.
      </Notice>
      <EventMediaHeader
        eventId={event.id}
        tenantSlug={event.tenantSlug}
        testID={`fixture-media-${event.id}`}
      />
      <Notice title={event.name}>{event.brand.organizationName}</Notice>
      <Text selectable style={{ color: colors.label, fontSize: 19 }}>
        {eventDate(event)}
      </Text>
      <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
        {event.timezone}
      </Text>
      <Text selectable style={{ color: colors.label, fontSize: 19 }}>
        {event.location}
      </Text>
      <Notice title="Đăng ký">
        Chỉ thông tin mẫu. Không đăng ký vé từ dữ liệu demo.
      </Notice>
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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
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
            ? 'API nội dung đã xuất bản không tới được. Không dùng demo thay thế.'
            : 'Phản hồi nội dung đã xuất bản không hợp lệ.',
      });
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [tenantSlug, slug]);

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
          Không có projection đã xuất bản cho tổ chức/sự kiện này (404). Bản
          nháp không hiện. Đây không phải demo.
        </EmptyState>
      </Page>
    );
  }

  if (phase.kind === 'error') {
    return (
      <Page>
        <ErrorState title={eventsCopy.errorDetail.title}>
          {phase.message}
        </ErrorState>
      </Page>
    );
  }

  return <PublishedEventBrandSync event={phase.event} />;
}

/** Apply published event brand into ThemeProvider (S-P0-C) then render chrome. */
function PublishedEventBrandSync({
  event,
}: {
  event: PublishedEventDetail;
}) {
  const { applyBranding } = useTheme();
  const sections = visibleSectionsInOrder(event);

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
      <Text style={{ color: colors.secondary, fontSize: 13 }}>
        Đã xuất bản · {event.brand.organizationName}
      </Text>
      <View
        style={{
          padding: 16,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderTopWidth: 4,
          borderTopColor: event.brand.primaryColor,
          gap: 8,
        }}
      >
        <EventMediaHeader
          eventId={event.id}
          tenantSlug={event.tenantSlug}
          bannerUrl={event.brand.bannerUrl}
          logoUrl={event.brand.logoUrl}
          testID={`pub-detail-media-${event.id}`}
        />
        <Text selectable style={{ color: colors.secondary }}>
          {event.brand.organizationName}
        </Text>
        <Text
          selectable
          style={{ color: colors.label, fontSize: 24, fontWeight: '600' }}
        >
          {event.name}
        </Text>
        {event.startsAt ? (
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {formatPublishedDate(event.startsAt, event.timezone)}
          </Text>
        ) : (
          <Text selectable style={{ color: colors.secondary, fontSize: 17 }}>
            Chưa có giờ bắt đầu trên nội dung đã xuất bản
          </Text>
        )}
        {event.location ? (
          <Text selectable style={{ color: colors.label, fontSize: 17 }}>
            {event.location}
          </Text>
        ) : null}
        {event.brand.contact ? (
          <Text selectable style={{ color: colors.secondary, fontSize: 15 }}>
            {event.brand.contact}
          </Text>
        ) : null}
      </View>

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
              style={{ marginBottom: 8, color: colors.label }}
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
    </Page>
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
