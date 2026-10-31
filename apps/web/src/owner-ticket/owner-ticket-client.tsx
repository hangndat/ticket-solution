'use client';

import { useCallback } from 'react';
import { isUuid } from '../bff/ids';
import { attendeeTicketMain } from '../attendee-detail-surface';
import { ConsumerPageShell } from '../consumer-page-shell';
import { hasDemoMediaForEventId } from '../demo-media';
import { parseMeTenantsResponse } from '../nav/capabilities';
import { fetchBoundJson, useWebActorData, type PrivateView, type WebActorIdentity } from '../oidc/client-actor-gate';
import {
  OwnerTicketForbidden,
  OwnerTicketHeading,
  OwnerTicketInvalid,
  OwnerTicketLoading,
  OwnerTicketMissing,
  OwnerTicketNeedLogin,
  OwnerTicketReady,
  OwnerTicketTenantUnresolved,
  OwnerTicketUnreachable,
} from './owner-ticket-chrome';
import { parseOwnerTicketDetail } from './parse';
import type { OwnerTicketDetail } from './types';

type Props = {
  tenantSlug: string;
  ticketId: string;
  explicitTenantId: string | null;
  path: string;
  loginHref: string;
  valid: boolean;
};

export function OwnerTicketClient({ tenantSlug, ticketId, explicitTenantId, path, loginHref, valid }: Props) {
  const loader = useCallback(async (
    identity: WebActorIdentity,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ): Promise<PrivateView<OwnerTicketDetail>> => {
    let tenantId = explicitTenantId && isUuid(explicitTenantId) ? explicitTenantId : null;
    if (!tenantId) {
      const tenants = await fetchBoundJson('/api/bff/me/tenants', identity, signal, isCurrent);
      if (tenants.status === 401) return { status: 'unauthenticated' };
      if (tenants.status >= 500) return { status: 'unreachable' };
      const parsed = parseMeTenantsResponse(tenants.status, tenants.body);
      if (!parsed) return { status: 'tenant-unresolved' };
      tenantId = parsed.items.find((item) => item.slug.toLowerCase() === tenantSlug)?.tenantId ?? null;
      if (!tenantId) return { status: 'tenant-unresolved' };
    }
    const detail = await fetchBoundJson(
      `/api/bff/tickets/${encodeURIComponent(ticketId)}?tenantId=${encodeURIComponent(tenantId)}`,
      identity,
      signal,
      isCurrent,
    );
    if (detail.status === 401) return { status: 'unauthenticated' };
    if (detail.status === 403) return { status: 'forbidden' };
    if (detail.status === 404) return { status: 'not-found' };
    if (detail.status >= 500) return { status: 'unreachable' };
    if (detail.status !== 200) return { status: 'invalid' };
    const ticket = parseOwnerTicketDetail(detail.body);
    return ticket ? { status: 'ready', value: ticket } : { status: 'invalid' };
  }, [explicitTenantId, tenantSlug, ticketId]);
  const view = useWebActorData(loader);
  const status = valid ? view.status : 'invalid';
  return (
    <ConsumerPageShell mainClassName={attendeeTicketMain} mainTestId={`owner-ticket-${status === 'unauthenticated' ? 'need-login' : status === 'not-found' ? 'missing' : status}`}>
      {status === 'ready' && view.status === 'ready' ? (
        <OwnerTicketReady
          ticket={view.value}
          tenantSlug={tenantSlug}
          isDemo={hasDemoMediaForEventId(view.value.eventId) || tenantSlug.includes('demo') || tenantSlug.includes('fixture')}
        />
      ) : (
        <>
          <OwnerTicketHeading />
          {status === 'loading' ? <OwnerTicketLoading /> : null}
          {status === 'invalid' ? <OwnerTicketInvalid /> : null}
          {status === 'unauthenticated' ? <OwnerTicketNeedLogin loginHref={loginHref} /> : null}
          {status === 'unreachable' ? <OwnerTicketUnreachable path={path} /> : null}
          {status === 'tenant-unresolved' ? <OwnerTicketTenantUnresolved /> : null}
          {status === 'forbidden' ? <OwnerTicketForbidden /> : null}
          {status === 'not-found' ? <OwnerTicketMissing /> : null}
        </>
      )}
    </ConsumerPageShell>
  );
}
