import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import {
  attendeeWalletCopy,
  isUsedTicketState,
  presentTicketRow,
  ticketGateHint,
  ticketScheduleVenueLines
} from '@/attendee/attendee-outcome-copy';
import { TicketUsedStamp } from '@/components/ticket-used-stamp';
import { AttendeeStateCard } from '@/components/attendee-state-card';
import { walletCopy } from '@/components/screen-state-copy';
import { EventBanner } from '@/components/event-media';
import { Notice } from '@/components/page';
import { AttendeeCta } from '@/components/attendee-cta';
import { QrCode } from '@/components/qr-code';
import { TicketStatusPill } from '@/components/ticket-status-pill';
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { findDemoEventById } from '@/data/demo-events';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { session } from '@/identity/session';
import { buildDisplayQrPayload } from '@/tickets/display-payload';
import { readTicketDisplayCache } from '@/tickets/display-cache';
import { probeMeTickets } from '@/tickets/fetch-me-tickets';
import {
  findOwnedTicket,
  normalizeTicketRouteId,
  ticketDetailFromMeTicketsProbe,
  ticketDetailVerifiedScopes,
} from '@/tickets/ticket-detail-lookup';
import { walletFetchScopeFromEnv } from '@/tickets/wallet-fetch-scope';
import { offlineDisplay } from '@/tickets/offline-display-session';
import { walletOfflineNoticeBody } from '@/tickets/wallet-sync-display';
import { ownerBannerUrl, ownerText } from '@/tickets/owner-metadata';
import { space, radius } from '@/theme/tokens';
import { ATTENDEE_ACCOUNT_HREF, GUEST_HOME_HREF } from '@/navigation/attendee-account-route';

type LoadOwner = {
  ownerUserId: string;
  ownerTenantId: string;
  ticketId: string;
  mode: 'verified' | 'offline-display';
};

type LoadState =
  | { status: 'idle' }
  | (LoadOwner & {
      status: 'ready';
      ticket: TicketSummary;
      syncedAt: string | null;
      fromCache: boolean;
    })
  | (LoadOwner & { status: 'missing' })
  | (LoadOwner & {
      status: 'error';
      reason: 'unreachable' | 'unauthorized' | 'invalid';
    });

function TicketDetailPage({ children, compact = false }: PropsWithChildren<{ compact?: boolean }>) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: compact ? space.xs : space.md,
        paddingBottom: space.huge,
        gap: compact ? space.md : space.xl,
      }}
    >
      {children}
    </ScrollView>
  );
}

function loadMatchesOwner(
  load: LoadState,
  owner: LoadOwner | null,
): load is Extract<LoadState, { status: 'ready' | 'missing' | 'error' }> {
  if (
    !owner ||
    (load.status !== 'ready' &&
      load.status !== 'missing' &&
      load.status !== 'error')
  ) {
    return false;
  }
  return (
    load.ownerUserId === owner.ownerUserId &&
    load.ownerTenantId === owner.ownerTenantId &&
    load.ticketId === owner.ticketId &&
    load.mode === owner.mode
  );
}

export function TicketDetailScreen() {
  const params = useLocalSearchParams<{ ticketId?: string | string[] }>();
  const ticketId = normalizeTicketRouteId(params.ticketId);
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const offline = useSyncExternalStore(
    offlineDisplay.subscribe,
    offlineDisplay.getSnapshot,
    offlineDisplay.getSnapshot,
  );
  const fetchScope = useMemo(() => walletFetchScopeFromEnv(), []);
  const verifiedScopes = useMemo(
    () => ticketDetailVerifiedScopes(fetchScope),
    [fetchScope],
  );
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;
  const offlineUserId = offline.status === 'bound' ? offline.userId : null;
  const offlineTenantId = offline.status === 'bound' ? offline.tenantId : null;

  const displayUserId = verifiedUserId ?? offlineUserId;
  const lookupSessionScope = verifiedUserId
    ? verifiedScopes.sessionScope
    : offlineTenantId;
  const lookupCacheScope = verifiedUserId
    ? verifiedScopes.cacheScope
    : offlineTenantId;
  const displayMode: 'verified' | 'offline-display' | null = verifiedUserId
    ? 'verified'
    : offlineUserId
      ? 'offline-display'
      : null;

  const owner = useMemo<LoadOwner | null>(() => {
    if (!displayUserId || !lookupCacheScope || !ticketId || !displayMode) {
      return null;
    }
    return {
      ownerUserId: displayUserId,
      ownerTenantId: lookupCacheScope,
      ticketId,
      mode: displayMode
    };
  }, [displayMode, displayUserId, lookupCacheScope, ticketId]);

  // Refuse stale ready state immediately on identity switch — do not wait for
  // useEffect to clear, or one frame can render account A's QR under B.
  const visibleLoad = useMemo<LoadState>(
    () => (loadMatchesOwner(load, owner) ? load : { status: 'idle' }),
    [load, owner],
  );

  useEffect(() => {
    if (
      !displayUserId ||
      !lookupCacheScope ||
      !lookupSessionScope ||
      !ticketId ||
      !displayMode
    ) {
      return;
    }
    const ownerUserId = displayUserId;
    const ownerTenantId = lookupCacheScope;
    const id = ticketId;
    const mode = displayMode;
    const sessionScope = lookupSessionScope;
    const cacheScope = lookupCacheScope;
    let cancelled = false;
    void (async () => {
      const cache = await readTicketDisplayCache(ownerUserId, cacheScope);
      const found = findOwnedTicket(cache?.tickets, id);
      if (cancelled) return;
      if (mode === 'offline-display' && found) {
        setLoad({
          status: 'ready',
          ticket: found,
          syncedAt: cache?.syncedAt ?? null,
          fromCache: true,
          ownerUserId,
          ownerTenantId,
          ticketId: id,
          mode
        });
        return;
      }
      if (mode === 'verified') {
        const credential = await session.resolveCredential();
        if (cancelled) return;
        if (credential.status === 'unavailable') {
          setLoad({
            status: 'error',
            reason: 'unauthorized',
            ownerUserId,
            ownerTenantId,
            ticketId: id,
            mode
          });
          return;
        }
        const probe =
          credential.status === 'refresh-unreachable'
            ? ({ status: 'unreachable' } as const)
            : await probeMeTickets(credential.accessToken, fetchScope);
        if (cancelled) return;
        const outcome = ticketDetailFromMeTicketsProbe(probe, id);
        if (outcome.status === 'ready') {
          if (probe.status === 'ok') {
            await session.load(sessionScope, 'me-tickets', async () => probe.body.tickets);
          }
          if (cancelled) return;
          setLoad({
            status: 'ready',
            ticket: outcome.ticket,
            syncedAt: new Date().toISOString(),
            fromCache: false,
            ownerUserId,
            ownerTenantId,
            ticketId: id,
            mode
          });
          return;
        }
        if (outcome.status === 'error') {
          // Preserve offline metadata, but never use cache after authorization
          // fails. Legacy cache still gets an explicit QR-unavailable notice.
          if (outcome.reason === 'unreachable' && found) {
            setLoad({
              status: 'ready', ticket: found,
              syncedAt: cache?.syncedAt ?? null, fromCache: true,
              ownerUserId, ownerTenantId, ticketId: id, mode,
            });
            return;
          }
          setLoad({
            status: 'error',
            reason: outcome.reason,
            ownerUserId,
            ownerTenantId,
            ticketId: id,
            mode
          });
          return;
        }
      }
      if (cancelled) return;
      setLoad({
        status: 'missing',
        ownerUserId,
        ownerTenantId,
        ticketId: id,
        mode
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    displayMode,
    displayUserId,
    fetchScope,
    lookupCacheScope,
    lookupSessionScope,
    reloadKey,
    ticketId,
  ]);

  const qrValue = useMemo(
    () =>
      visibleLoad.status === 'ready'
        ? buildDisplayQrPayload(visibleLoad.ticket)
        : '',
    [visibleLoad],
  );

  if (!displayMode || !owner) {
    if (displayMode) {
      return (
        <TicketDetailPage>
          <AttendeeStateCard
            symbol="ticket"
            title={walletCopy.detailMissingTitle}
            tone="warning"
            testID="ticket-detail-invalid-route"
          >
            {walletCopy.detailMissingBody}
          </AttendeeStateCard>
          <AttendeeCta label="Về Vé của tôi" onPress={() => router.replace('/wallet-access' as Href)} testID="ticket-detail-home" />
        </TicketDetailPage>
      );
    }
    return (
      <TicketDetailPage>
        <AttendeeStateCard
          symbol="person.crop.circle"
          title={walletCopy.guestWalletBlockedTitle}
          testID="ticket-detail-guest-state"
        >
          {walletCopy.guestWalletBlockedBody}
        </AttendeeStateCard>
        <AttendeeCta label="Đăng nhập" onPress={() => router.push(ATTENDEE_ACCOUNT_HREF)} testID="ticket-detail-guest-signin" />
        <AttendeeCta label="Khám phá sự kiện" variant="secondary" onPress={() => router.replace(GUEST_HOME_HREF)} testID="ticket-detail-guest-events" />
      </TicketDetailPage>
    );
  }

  if (visibleLoad.status === 'idle') {
    return (
      <TicketDetailPage>
        <Notice title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </Notice>
      </TicketDetailPage>
    );
  }

  if (visibleLoad.status === 'error') {
    return (
      <TicketDetailPage>
        <AttendeeStateCard
          symbol={visibleLoad.reason === 'unreachable' ? 'wifi.exclamationmark' : 'ticket'}
          title={visibleLoad.reason === 'unauthorized' ? 'Cần đăng nhập lại' : walletCopy.detailProbeErrorTitle}
          tone={visibleLoad.reason === 'unreachable' ? 'warning' : 'error'}
          testID="ticket-detail-error-state"
        >
          {visibleLoad.reason === 'unreachable'
            ? walletCopy.detailProbeErrorBody
            : visibleLoad.reason === 'unauthorized'
                ? `Phiên đăng nhập không còn hiệu lực. Đăng nhập lại để xem vé. ${walletCopy.credentialUnavailableBody}`
                : `Không xác minh được vé cho tài khoản hiện tại. ${walletCopy.credentialUnavailableBody}`}
        </AttendeeStateCard>
        {visibleLoad.reason === 'unreachable' ? (
          <AttendeeCta label="Thử lại" onPress={() => setReloadKey((key) => key + 1)} testID="ticket-detail-error-retry" />
        ) : null}
        <AttendeeCta label="Về Vé của tôi" variant="secondary" onPress={() => router.replace('/wallet-access' as Href)} testID="ticket-detail-home" />
      </TicketDetailPage>
    );
  }

  if (visibleLoad.status === 'missing') {
    return (
      <TicketDetailPage>
        <AttendeeStateCard
          symbol="ticket"
          title={walletCopy.detailMissingTitle}
          tone="warning"
          testID="ticket-detail-missing-state"
        >
          {walletCopy.detailMissingBody}
        </AttendeeStateCard>
        <AttendeeCta label="Về Vé của tôi" onPress={() => router.replace('/wallet-access' as Href)} testID="ticket-detail-home" />
      </TicketDetailPage>
    );
  }

  const { ticket, fromCache, mode, syncedAt } = visibleLoad;
  const row = presentTicketRow(ticket);
  const { when: eventWhen, where: eventWhere } = ticketScheduleVenueLines(ticket);
  const isDemo =
    hasDemoMediaForEventId(ticket.eventId) ||
    Boolean(findDemoEventById(ticket.eventId));
  const used = isUsedTicketState(ticket.state);
  const credentialAvailable = Boolean(qrValue);
  const credentialUnavailable = !credentialAvailable && !used;
  const gateHint = used ? null : ticketGateHint(ticket.state, { demo: isDemo });
  const qrA11y = used
    ? attendeeWalletCopy.usedQrA11y
    : `Mã QR vé ${row.eventTitle}`;

  return (
    <TicketDetailPage compact={credentialUnavailable}>
      <View
        accessible={used}
        accessibilityLabel={used ? attendeeWalletCopy.usedWatermarkA11y : undefined}
        style={{
          backgroundColor: colors.ticketCanvas,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
            borderColor: used ? colors.line : brand.primary
        }}
      >
        {used ? <TicketUsedStamp /> : null}
        <View
          style={{
            height: 6,
            backgroundColor: used ? colors.secondary : brand.primary
          }}
        />
        <View style={{ opacity: used ? 0.45 : 1 }}>
          <EventBanner
            eventId={ticket.eventId}
            bannerUrl={ownerBannerUrl(ticket)}
            allowDemoMedia={false}
            wordmark={row.eventTitle}
            showFallbackName={false}
            height={credentialUnavailable ? 56 : 76}
            style={{ borderRadius: 0 }}
            testID="ticket-detail-banner"
            accessibilityLabel={`Banner ${row.eventTitle}`}
          />
        </View>
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: credentialUnavailable ? space.sm : space.md,
            paddingBottom: credentialUnavailable ? space.sm : space.xl,
            gap: credentialUnavailable ? space.sm : space.md,
            alignItems: 'stretch',
          }}
        >
          <Text
            maxFontSizeMultiplier={2}
            accessibilityRole="header"
            style={{ ...typography.sectionTitleBold, color: brand.ink,
              textAlign: 'center' }}
          >
            {row.eventTitle}
          </Text>
          {used ? null : credentialAvailable ? (
            <View style={{ alignItems: 'center' }}>
              <TicketStatusPill label={row.statusLabel} />
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.secondary, backgroundColor: colors.surfaceMuted, paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill }}>
                Đang cập nhật mã
              </Text>
            </View>
          )}
          {eventWhen ? (
            <Text
              style={{ ...typography.subhead, color: colors.secondary,
                lineHeight: 22,
                textAlign: 'center' }}
            >
              {eventWhen}
            </Text>
          ) : null}
          {eventWhere ? (
            <Text
              style={{ ...typography.subhead, color: colors.secondary,
                lineHeight: 22,
                textAlign: 'center' }}
            >
              {eventWhere}
            </Text>
          ) : null}
          {ownerText(ticket.ticketTypeLabel) ? (
            <Text style={{ ...typography.subhead, color: colors.secondary, textAlign: 'center' }}>
              {`Loại vé · ${ownerText(ticket.ticketTypeLabel)}`}
            </Text>
          ) : null}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              borderTopWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.line,
              marginVertical: space.xs,
              alignSelf: 'stretch'
            }}
          />
          {credentialAvailable ? (
            <View style={{ opacity: used ? 0.28 : 1 }}>
              <QrCode
                value={qrValue}
                inkColor={used ? colors.secondary : brand.ink}
                paperColor={colors.onAccent}
                accessibilityLabel={qrA11y}
              />
            </View>
          ) : (
            <View testID="ticket-detail-credential-unavailable" style={{ minHeight: credentialUnavailable ? 104 : 184, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surfaceSubtle, justifyContent: 'center', alignItems: 'center', gap: space.sm, padding: space.md }}>
              <Text style={{ ...typography.title, color: colors.secondary }}>▦</Text>
              <Text style={{ ...typography.subhead, color: colors.secondary, textAlign: 'center' }}>Chưa có mã QR để quét</Text>
            </View>
          )}
          {credentialAvailable ? <Text style={{ ...typography.caption, color: colors.secondary, textAlign: 'center' }}>{used ? 'Vé này không còn hiệu lực vào cổng' : 'Đưa mã này cho nhân viên tại cổng'}</Text> : null}
          {!used ? (
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Text style={{ ...typography.caption, color: colors.secondary }}>
                Mã nhập tay
              </Text>
              <Text
                selectable
                accessibilityLabel="Mã nhập tay trên vé"
                style={credentialAvailable && ticket.manualEntryCode ? { ...typography.sectionTitleBold, color: brand.ink } : { ...typography.subhead, color: colors.secondary }}
              >
                {credentialAvailable && ticket.manualEntryCode ? ticket.manualEntryCode : 'Chưa có mã nhập tay'}
              </Text>
            </View>
          ) : null}
          <Text
            selectable
            style={{
              color: colors.secondary,
              ...typography.caption,
              textAlign: 'center'
            }}
          >
            Mã vé · …{row.ticketId.slice(-4)}
          </Text>
        </View>
      </View>
      {mode === 'offline-display' || fromCache ? (
        <Notice title={attendeeWalletCopy.offlineBannerTitle}>
          {walletOfflineNoticeBody(attendeeWalletCopy.offlineBannerBody, syncedAt)}
        </Notice>
      ) : null}
      {credentialUnavailable ? (
        <>
          <AttendeeStateCard
            symbol="qrcode"
            title="Chưa thể dùng vé tại cổng"
            tone="warning"
            testID="ticket-detail-credential-state"
          >
            {`${walletCopy.credentialUnavailableBody} Kết nối mạng và cập nhật lại; thông tin sự kiện và vé vẫn được giữ.`}
          </AttendeeStateCard>
          {mode === 'verified' ? (
            <AttendeeCta label="Cập nhật mã vào cổng" onPress={() => setReloadKey((key) => key + 1)} testID="ticket-detail-credential-retry" />
          ) : null}
        </>
      ) : gateHint ? (
        <Notice title={gateHint} tone="deny">
          {isDemo ? 'Vé demo / fixture — không dùng để vào cổng.' : 'Trạng thái vé không cho phép quét cổng.'}
        </Notice>
      ) : (
        <Text style={{ ...typography.caption, color: colors.secondary, textAlign: 'center' }}>
          Máy chủ quyết định vé còn hiệu lực tại thời điểm quét.
        </Text>
      )}
    </TicketDetailPage>
  );
}
