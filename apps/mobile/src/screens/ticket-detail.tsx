import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import {
  attendeeWalletCopy,
  presentTicketRow,
  ticketGateHint,
  ticketScheduleVenueLines
} from '@/attendee/attendee-outcome-copy';
import { walletCopy } from '@/components/screen-state-copy';
import { EventBanner, EventLogo } from '@/components/event-media';
import { BrandWordmark, Notice, Page } from '@/components/page';
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
  ticketDetailVerifiedScopes,
} from '@/tickets/ticket-detail-lookup';
import { walletFetchScopeFromEnv } from '@/tickets/wallet-fetch-scope';
import { offlineDisplay } from '@/tickets/offline-display-session';
import { walletOfflineNoticeBody } from '@/tickets/wallet-sync-display';
import { space, radius } from '@/theme/tokens';

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
  | (LoadOwner & { status: 'missing' });

function loadMatchesOwner(
  load: LoadState,
  owner: LoadOwner | null,
): load is Extract<LoadState, { status: 'ready' | 'missing' }> {
  if (!owner || (load.status !== 'ready' && load.status !== 'missing')) {
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
      if (mode === 'verified') {
        const memory = session.read<TicketSummary[]>(sessionScope, 'me-tickets');
        const fromMemory = findOwnedTicket(memory, id);
        if (fromMemory) {
          if (!cancelled) {
            setLoad({
              status: 'ready',
              ticket: fromMemory,
              syncedAt: new Date().toISOString(),
              fromCache: false,
              ownerUserId,
              ownerTenantId,
              ticketId: id,
              mode
            });
          }
          return;
        }
      }
      const cache = await readTicketDisplayCache(ownerUserId, cacheScope);
      const found = findOwnedTicket(cache?.tickets, id);
      if (cancelled) return;
      if (found) {
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
        if (credential.status !== 'unavailable') {
          const probe =
            credential.status === 'refresh-unreachable'
              ? ({ status: 'unreachable' } as const)
              : await probeMeTickets(credential.accessToken, fetchScope);
          if (cancelled) return;
          if (probe.status === 'ok') {
            const live = findOwnedTicket(probe.body.tickets, id);
            if (live) {
              await session.load(sessionScope, 'me-tickets', async () => probe.body.tickets);
              if (cancelled) return;
              setLoad({
                status: 'ready',
                ticket: live,
                syncedAt: new Date().toISOString(),
                fromCache: false,
                ownerUserId,
                ownerTenantId,
                ticketId: id,
                mode
              });
              return;
            }
          }
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
    return (
      <Page>
        <Notice title={walletCopy.guestWalletBlockedTitle}>
          {walletCopy.guestWalletBlockedBody}
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'idle') {
    return (
      <Page>
        <Notice title={walletCopy.loading.title}>
          {walletCopy.loading.body}
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'missing') {
    return (
      <Page>
        <Notice title="Không tìm thấy vé">
          Không có vé khớp id này cho danh tính hiện tại. Kéo để làm mới Vé của
          tôi khi online.
        </Notice>
      </Page>
    );
  }

  const { ticket, fromCache, mode, syncedAt } = visibleLoad;
  const row = presentTicketRow(ticket);
  const { when: eventWhen, where: eventWhere } = ticketScheduleVenueLines(ticket);
  const isDemo =
    hasDemoMediaForEventId(ticket.eventId) ||
    Boolean(findDemoEventById(ticket.eventId));
  const gateHint = ticketGateHint(ticket.state, { demo: isDemo });
  const qrA11y = `Mã QR vé ${row.eventTitle}`;

  return (
    <Page>
      {mode === 'offline-display' || fromCache ? (
        <Notice title={attendeeWalletCopy.offlineBannerTitle}>
          {walletOfflineNoticeBody(
            attendeeWalletCopy.offlineBannerBody,
            syncedAt,
          )}
        </Notice>
      ) : null}
      {gateHint ? (
        <Notice title={gateHint} tone="deny">
          {isDemo
            ? 'Vé demo / fixture — không dùng để vào cổng.'
            : 'Trạng thái vé không cho phép quét cổng.'}
        </Notice>
      ) : null}
      <View
        style={{
          backgroundColor: colors.ticketCanvas,
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: brand.signal
        }}
      >
        <View
          style={{
            height: 6,
            backgroundColor: brand.signal
          }}
        />
        {hasDemoMediaForEventId(ticket.eventId) ? (
          <EventBanner
            eventId={ticket.eventId}
            height={120}
            style={{ borderRadius: 0 }}
            testID="ticket-detail-banner"
            accessibilityLabel="Banner sự kiện demo trên vé"
          />
        ) : null}
        <View style={{ padding: space.xl, gap: space.lg, alignItems: 'stretch' }}>
          <View style={{ alignItems: 'center', gap: space.md, width: '100%' }}>
            {hasDemoMediaForEventId(ticket.eventId) ? (
              <EventLogo
                eventId={ticket.eventId}
                height={32}
                testID="ticket-detail-logo"
                accessibilityLabel="Logo sự kiện demo trên vé"
              />
            ) : (
              <BrandWordmark compact />
            )}
            <TicketStatusPill label={row.statusLabel} />
          </View>
          <Text
            maxFontSizeMultiplier={2}
            style={{
              color: brand.ink,
              ...typography.display,
              textAlign: 'center'
            }}
          >
            Vé của bạn
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            accessibilityRole="header"
            style={{ ...typography.sectionTitle, color: brand.ink,
              textAlign: 'center' }}
          >
            {row.eventTitle}
          </Text>
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
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: 1,
              backgroundColor: colors.line,
              marginVertical: space.xs,
              alignSelf: 'stretch'
            }}
          />
          {qrValue ? (
            <QrCode
              value={qrValue}
              inkColor={brand.ink}
              paperColor={colors.onAccent}
              accessibilityLabel={qrA11y}
            />
          ) : null}
          <Text
            selectable
            style={{
              color: colors.secondary,
              ...typography.caption,
              textAlign: 'center'
            }}
          >
            {row.ticketId}
          </Text>
          <Text
            selectable
            style={{ ...typography.micro, color: colors.secondary,
              textAlign: 'center' }}
          >
            {row.credentialLine}
          </Text>
          <Text
            style={{ ...typography.subhead, color: colors.secondary,
              lineHeight: 22,
              textAlign: 'center' }}
          >
            {attendeeWalletCopy.detailOnlyDisplay}
          </Text>
        </View>
      </View>
    </Page>
  );
}
