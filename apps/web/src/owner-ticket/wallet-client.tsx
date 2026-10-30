'use client';

import { useCallback } from 'react';
import { attendeeWalletGrid, attendeeWalletPage } from '../attendee-detail-surface';
import { ConsumerPageShell } from '../consumer-page-shell';
import { parseMeTenantsResponse } from '../nav/capabilities';
import { fetchBoundJson, useWebActorData, type PrivateView } from '../oidc/client-actor-gate';
import type { WebActorIdentity } from '../oidc/client-actor-gate';
import { buildWalletEventFilters } from './wallet-event-filter-data';
import { WalletEventFilters } from './wallet-event-filters';
import { WalletTicketCard } from './wallet-ticket-card';
import { parseMeTicketsResponse } from './parse';
import type { WalletTicketRow } from './types';
import {
  WalletEmpty,
  WalletFilterEmpty,
  WalletHeading,
  WalletInvalid,
  WalletLoading,
  WalletNeedLogin,
  WalletUnreachable,
} from './wallet-chrome';

type WalletData = { tickets: WalletTicketRow[]; tenantSlugById: Record<string, string> };

export function WalletClient({ eventFilter, loginHref }: { eventFilter: string | null; loginHref: string }) {
  const loader = useCallback(async (
    identity: WebActorIdentity,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ): Promise<PrivateView<WalletData>> => {
    const tenants = await fetchBoundJson('/api/bff/me/tenants', identity, signal, isCurrent);
    if (tenants.status === 401) return { status: 'unauthenticated' };
    if (tenants.status >= 500) return { status: 'unreachable' };
    const parsedTenants = parseMeTenantsResponse(tenants.status, tenants.body);
    if (!parsedTenants) return { status: 'invalid' };
    const tenantSlugById: Record<string, string> = {};
    for (const tenant of parsedTenants.items) {
      tenantSlugById[tenant.tenantId.toLowerCase()] = tenant.slug.toLowerCase();
    }
    const list = await fetchBoundJson('/api/bff/tickets', identity, signal, isCurrent);
    if (list.status === 401) return { status: 'unauthenticated' };
    if (list.status >= 500) return { status: 'unreachable' };
    if (list.status !== 200) return { status: 'invalid' };
    const tickets = parseMeTicketsResponse(list.body);
    return tickets ? { status: 'ready', value: { tickets, tenantSlugById } } : { status: 'invalid' };
  }, []);
  const view = useWebActorData(loader);
  const tickets = view.status === 'ready' ? view.value.tickets : [];
  const visible = eventFilter ? tickets.filter((ticket) => ticket.eventId === eventFilter) : tickets;

  return (
    <ConsumerPageShell mainClassName={attendeeWalletPage} mainTestId={`wallet-${view.status === 'unauthenticated' ? 'need-login' : view.status}`}>
      <WalletHeading showIntro={view.status === 'ready' || view.status === 'unauthenticated'} showCta={view.status === 'ready'} />
      {view.status === 'loading' ? <WalletLoading /> : null}
      {view.status === 'unauthenticated' ? <WalletNeedLogin loginHref={loginHref} /> : null}
      {view.status === 'unreachable' ? <WalletUnreachable /> : null}
      {view.status === 'invalid' ? <WalletInvalid /> : null}
      {view.status === 'ready' ? (
        tickets.length === 0 ? <WalletEmpty /> : <>
          <WalletEventFilters filters={buildWalletEventFilters(tickets)} activeEventId={eventFilter} totalCount={tickets.length} />
          {visible.length === 0 ? <WalletFilterEmpty /> : (
            <div className={attendeeWalletGrid} role="list" data-testid="wallet-ticket-grid">
              {visible.map((ticket) => <WalletTicketCard key={ticket.ticketId} ticket={ticket} tenantSlug={view.value.tenantSlugById[ticket.tenantId.toLowerCase()] ?? null} />)}
            </div>
          )}
        </>
      ) : null}
    </ConsumerPageShell>
  );
}
