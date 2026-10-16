import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { TicketSummary } from '@ticket/contracts';
import { Notice, Page } from '@/components/page';
import { QrCode } from '@/components/qr-code';
import { colors } from '@/theme/colors';
import { getTenantId } from '@/identity/config';
import { session } from '@/identity/session';
import { buildDisplayQrPayload } from '@/tickets/display-payload';
import { readTicketDisplayCache } from '@/tickets/display-cache';
import { offlineDisplay } from '@/tickets/offline-display-session';

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
      mode: displayMode,
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
              mode,
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
          mode,
        });
      } else {
        setLoad({
          status: 'missing',
          ownerUserId,
          ownerTenantId,
          ticketId: id,
          mode,
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
        <Notice title="Sign in required">
          Ticket detail requires a verified SessionBoundary (GET /v1/me) or a
          prior offline-display binding on this device.
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'idle') {
    return (
      <Page>
        <Notice title="Loading ticket">
          Reading session memory or offline display cache…
        </Notice>
      </Page>
    );
  }

  if (visibleLoad.status === 'missing') {
    return (
      <Page>
        <Notice title="Ticket not found">
          No cached or loaded ticket matches this id for the current identity.
          Pull to refresh My Tickets while online.
        </Notice>
      </Page>
    );
  }

  const { ticket, syncedAt, fromCache, mode } = visibleLoad;

  return (
    <Page>
      <Notice title="Ticket">
        ID: {ticket.ticketId}
        {'\n'}
        State: {ticket.state}
        {'\n'}
        Event: {ticket.eventId}
        {'\n'}
        Type: {ticket.ticketTypeId}
        {'\n'}
        Credential version: {ticket.credentialVersion}
        {'\n'}
        Created: {ticket.createdAt}
      </Notice>

      <View
        style={{
          padding: 20,
          gap: 12,
          backgroundColor: colors.card,
          borderRadius: 16,
          borderCurve: 'continuous',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.label, fontSize: 22, fontWeight: '600' }}>
          Display QR
        </Text>
        {qrValue ? <QrCode value={qrValue} /> : null}
        <Text
          style={{
            color: colors.secondary,
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'center',
          }}
        >
          Offline display of TicketSummary fields only — not a signed Gate
          credential and not offline check-in. Server Gate still decides
          revoked/used when a JWS credential API exists.
        </Text>
      </View>

      <Notice title="Sync">
        {mode === 'offline-display'
          ? 'Mode: offline-display binding (not SessionBoundary verified)'
          : fromCache
            ? 'Source: durable offline display cache'
            : 'Source: session memory / last fetch'}
        {'\n'}
        Last synced: {syncedAt ?? 'unknown'}
        {'\n'}
        Status may have changed since sync.
      </Notice>
    </Page>
  );
}
