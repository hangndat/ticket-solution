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
import { hasDemoMediaForEventId } from '@/data/demo-media';
import { findDemoEventById } from '@/data/demo-events';
import { brand, colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { buildDisplayQrPayload } from '@/tickets/display-payload';
import { readTicketDisplayCache } from '@/tickets/display-cache';
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
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
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
  const envTenantId = getTenantId();
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  const verifiedUserId =
    identity.status === 'verified' ? identity.userId : null;
  const offlineUserId = offline.status === 'bound' ? offline.userId : null;
  const offlineTenantId = offline.status === 'bound' ? offline.tenantId : null;

  const displayUserId = verifiedUserId ?? offlineUserId;
  const displayTenantId =
    (verifiedUserId ? envTenantId : null) ?? offlineTenantId;
  const displayMode: 'verified' | 'offline-display' | null = verifiedUserId
    ? 'verified'
    : offlineUserId
      ? 'offline-display'
      : null;

  const owner = useMemo<LoadOwner | null>(() => {
    if (!displayUserId || !displayTenantId || !ticketId || !displayMode) {
      return null;
    }
    return {
      ownerUserId: displayUserId,
      ownerTenantId: displayTenantId,
      ticketId,
      mode: displayMode
    };
  }, [displayMode, displayTenantId, displayUserId, ticketId]);

  // Refuse stale ready state immediately on identity switch — do not wait for
  // useEffect to clear, or one frame can render account A's QR under B.
  const visibleLoad = useMemo<LoadState>(
    () => (loadMatchesOwner(load, owner) ? load : { status: 'idle' }),
    [load, owner],
  );

  useEffect(() => {
    if (!displayUserId || !displayTenantId || !ticketId || !displayMode) {
      return;
    }
    const ownerUserId = displayUserId;
    const ownerTenantId = displayTenantId;
    const id = ticketId;
    const mode = displayMode;
    let cancelled = false;
    void (async () => {
      if (mode === 'verified') {
        const memory = session.read<TicketSummary[]>(ownerTenantId, 'me-tickets');
        const fromMemory = memory?.find((t) => t.ticketId === id) ?? null;
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
      const cache = await readTicketDisplayCache(ownerUserId, ownerTenantId);
      const found = cache?.tickets.find((t) => t.ticketId === id) ?? null;
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
      } else {
        setLoad({
          status: 'missing',
          ownerUserId,
          ownerTenantId,
          ticketId: id,
          mode
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayMode, displayTenantId, displayUserId, ticketId]);

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
        <View style={{ padding: space.xl, gap: space.lg, alignItems: 'center' }}>
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
          <Text
            style={{
              color: brand.ink,
              ...typography.display,
              textAlign: 'center'
            }}
          >
            Vé của bạn
          </Text>
          <Text
            style={{ ...typography.sectionTitle, color: brand.ink,
              textAlign: 'center' }}
          >
            {row.eventTitle}
          </Text>
          <Text
            style={{
              color: brand.signal,
              ...typography.callout,
              textAlign: 'center'
            }}
          >
            {row.statusLabel}
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
