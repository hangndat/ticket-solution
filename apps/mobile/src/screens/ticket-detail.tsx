import { useLocalSearchParams } from 'expo-router';
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
import { ErrorState } from '@/components/screen-state';
import { walletCopy } from '@/components/screen-state-copy';
import { EVENT_BANNER_HEIGHT_TICKET } from '@/components/event-banner-metrics';
import { EventBanner, EventLogo } from '@/components/event-media';
import { Notice } from '@/components/page';
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
  | (LoadOwner & { status: 'missing' })
  | (LoadOwner & {
      status: 'error';
      reason: 'unreachable' | 'unauthorized' | 'invalid';
    });

function TicketDetailPage({ children }: PropsWithChildren) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: space.huge,
        gap: space.xl,
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
    return (
      <TicketDetailPage>
        <Notice title={walletCopy.guestWalletBlockedTitle}>
          {walletCopy.guestWalletBlockedBody}
        </Notice>
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
        <ErrorState
          title={walletCopy.detailProbeErrorTitle}
          onRetry={() => setReloadKey((key) => key + 1)}
          retryLabel="Thử lại"
        >
          {walletCopy.detailProbeErrorBody}
        </ErrorState>
      </TicketDetailPage>
    );
  }

  if (visibleLoad.status === 'missing') {
    return (
      <TicketDetailPage>
        <Notice title={walletCopy.detailMissingTitle}>
          {walletCopy.detailMissingBody}
        </Notice>
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
  const gateHint = used ? null : ticketGateHint(ticket.state, { demo: isDemo });
  const qrA11y = used
    ? attendeeWalletCopy.usedQrA11y
    : `Mã QR vé ${row.eventTitle}`;

  return (
    <TicketDetailPage>
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
            backgroundColor: brand.primary
          }}
        />
        <EventBanner
          eventId={ticket.eventId}
          height={EVENT_BANNER_HEIGHT_TICKET}
          style={{ borderRadius: 0 }}
          testID="ticket-detail-banner"
          accessibilityLabel={`Banner ${row.eventTitle}`}
        />
        <View
          style={{
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: space.xl,
            gap: space.md,
            alignItems: 'stretch',
          }}
        >
          {hasDemoMediaForEventId(ticket.eventId) ? (
            <View style={{ alignItems: 'center' }}>
              <EventLogo
                eventId={ticket.eventId}
                height={32}
                testID="ticket-detail-logo"
                accessibilityLabel="Logo sự kiện demo trên vé"
              />
            </View>
          ) : null}
          <Text
            maxFontSizeMultiplier={2}
            accessibilityRole="header"
            style={{ ...typography.sectionTitleBold, color: brand.ink,
              textAlign: 'center' }}
          >
            {row.eventTitle}
          </Text>
          {used ? null : (
            <View style={{ alignItems: 'center' }}>
              <TicketStatusPill label={row.statusLabel} />
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
            <View style={{ opacity: used ? 0.28 : 1 }}>
              <QrCode
                value={qrValue}
                inkColor={used ? colors.secondary : brand.ink}
                paperColor={colors.onAccent}
                accessibilityLabel={qrA11y}
              />
            </View>
          ) : null}
          {!used ? (
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Text style={{ ...typography.caption, color: colors.secondary }}>
                Mã nhập tay
              </Text>
              <Text
                selectable
                accessibilityLabel="Mã nhập tay trên vé"
                style={{ ...typography.sectionTitleBold, color: brand.ink }}
              >
                {ticket.manualEntryCode ?? 'Chưa có mã nhập tay'}
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
    </TicketDetailPage>
  );
}
