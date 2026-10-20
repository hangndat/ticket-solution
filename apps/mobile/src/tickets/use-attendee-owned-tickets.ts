import { useEffect, useState, useSyncExternalStore } from 'react';
import type { TicketSummary } from '@ticket/contracts';
import { session } from '@/identity/session';
import { dedupedAttendeeProbeMeTickets } from '@/tickets/attendee-probe-inflight';
import { probeMeTickets } from '@/tickets/fetch-me-tickets';
import {
  walletFetchScopeFromEnv,
  walletSessionScope,
} from '@/tickets/wallet-fetch-scope';

/**
 * Owner ticket list for attendee CTAs (events home / detail).
 * Uses in-memory session cache when warm; otherwise one lightweight probe.
 */
export function useAttendeeOwnedTickets(): {
  tickets: TicketSummary[];
  loading: boolean;
  verified: boolean;
} {
  const identity = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const verified = identity.status === 'verified';
  const userId = verified ? identity.userId : null;
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    void (async () => {
      const fetchScope = walletFetchScopeFromEnv();
      const sessionScope = walletSessionScope(fetchScope);
      const cached = session.read<TicketSummary[]>(sessionScope, 'me-tickets');
      if (cached) {
        if (!cancelled) setTickets(cached);
        return;
      }

      if (!cancelled) setLoading(true);
      try {
        const bearer = await session.getCredential();
        if (!bearer || cancelled) return;
        const probe = await dedupedAttendeeProbeMeTickets(
          userId,
          sessionScope,
          bearer,
          fetchScope,
          probeMeTickets,
        );
        if (cancelled) return;
        if (probe.status === 'ok') {
          const rows = probe.body.tickets;
          setTickets(rows);
          await session.load(sessionScope, 'me-tickets', async () => rows);
        } else {
          setTickets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!verified) {
    return { tickets: [], loading: false, verified: false };
  }

  return { tickets, loading, verified: true };
}
