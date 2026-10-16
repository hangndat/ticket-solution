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

type LoadState =
  | { status: 'idle' }
  | { status: 'ready'; ticket: TicketSummary; syncedAt: string | null; fromCache: boolean }
  | { status: 'missing' };

export function TicketDetailScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const tenantId = getTenantId();
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  const canLoad =
    identity.status === 'verified' && Boolean(tenantId) && Boolean(ticketId);

  useEffect(() => {
    if (!canLoad || identity.status !== 'verified' || !tenantId || !ticketId) {
      return;
    }
    const userId = identity.userId;
    let cancelled = false;
    void (async () => {
      const memory = session.read<TicketSummary[]>(tenantId, 'me-tickets');
      const fromMemory = memory?.find((t) => t.ticketId === ticketId) ?? null;
      if (fromMemory) {
        if (!cancelled) {
          setLoad({
            status: 'ready',
            ticket: fromMemory,
            syncedAt: new Date().toISOString(),
            fromCache: false,
          });
        }
        return;
      }
      const cache = await readTicketDisplayCache(userId, tenantId);
      const found = cache?.tickets.find((t) => t.ticketId === ticketId) ?? null;
      if (cancelled) return;
      if (found) {
        setLoad({
          status: 'ready',
          ticket: found,
          syncedAt: cache?.syncedAt ?? null,
          fromCache: true,
        });
      } else {
        setLoad({ status: 'missing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoad, identity, tenantId, ticketId]);

  const qrValue = useMemo(
    () => (load.status === 'ready' ? buildDisplayQrPayload(load.ticket) : ''),
    [load],
  );

  if (identity.status !== 'verified') {
    return (
      <Page>
        <Notice title="Sign in required">
          Ticket detail requires a verified SessionBoundary (GET /v1/me).
        </Notice>
      </Page>
    );
  }

  if (!canLoad || load.status === 'idle') {
    return (
      <Page>
        <Notice title="Loading ticket">Reading session memory or offline display cache…</Notice>
      </Page>
    );
  }

  if (load.status === 'missing') {
    return (
      <Page>
        <Notice title="Ticket not found">
          No cached or loaded ticket matches this id for the current identity.
          Pull to refresh My Tickets while online.
        </Notice>
      </Page>
    );
  }

  const { ticket, syncedAt, fromCache } = load;

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
        {fromCache
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
