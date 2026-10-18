import type { MeTicketsResponse, TicketSummary } from '@ticket/contracts';
import { parseMeTenantsResponse } from '../nav/capabilities';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isTicketSummary(value: unknown): value is TicketSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.ticketId === 'string' &&
    typeof value.tenantId === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.ticketTypeId === 'string' &&
    typeof value.sourceId === 'string' &&
    typeof value.state === 'string' &&
    typeof value.credentialVersion === 'number' &&
    typeof value.createdAt === 'string'
  );
}

export function parseMeTicketsResponse(
  status: number,
  body: unknown,
): MeTicketsResponse | null {
  if (status !== 200 || !isRecord(body) || !Array.isArray(body.tickets)) {
    return null;
  }
  const tickets: TicketSummary[] = [];
  for (const row of body.tickets) {
    if (!isTicketSummary(row)) return null;
    tickets.push(row);
  }
  return { tickets };
}

export function findTicketById(
  tickets: TicketSummary[],
  ticketId: string,
): TicketSummary | null {
  const id = ticketId.trim().toLowerCase();
  return tickets.find((t) => t.ticketId.toLowerCase() === id) ?? null;
}

/**
 * Resolve tenant UUID for owner ticket load.
 * Prefer explicit tenantId (optional query); else match slug on me/tenants.
 */
export function resolveOwnerTenantId(input: {
  tenantSlug: string;
  explicitTenantId?: string | null;
  meTenantsStatus: number;
  meTenantsBody: unknown;
}):
  | { status: 'ok'; tenantId: string; source: 'query' | 'me-tenants' }
  | { status: 'unauthorized' }
  | { status: 'unresolved' }
  | { status: 'unreachable' } {
  const explicit = input.explicitTenantId?.trim() ?? '';
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      explicit,
    )
  ) {
    return { status: 'ok', tenantId: explicit, source: 'query' };
  }

  if (input.meTenantsStatus === 401) return { status: 'unauthorized' };
  if (input.meTenantsStatus >= 500) return { status: 'unreachable' };

  const parsed = parseMeTenantsResponse(
    input.meTenantsStatus,
    input.meTenantsBody,
  );
  if (!parsed) {
    return input.meTenantsStatus === 200
      ? { status: 'unresolved' }
      : { status: 'unreachable' };
  }

  const slug = input.tenantSlug.trim().toLowerCase();
  const match = parsed.items.find((item) => item.slug.toLowerCase() === slug);
  if (!match) return { status: 'unresolved' };
  return { status: 'ok', tenantId: match.tenantId, source: 'me-tenants' };
}

export type OwnerTicketLoadResult =
  | { status: 'ok'; ticket: TicketSummary }
  | { status: 'unauthorized' }
  | { status: 'tenant-unresolved' }
  | { status: 'not-found' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

export async function loadOwnerTicket(input: {
  tenantSlug: string;
  ticketId: string;
  explicitTenantId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<OwnerTicketLoadResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let tenantsRes: Response;
  try {
    tenantsRes = await fetchImpl('/api/bff/me/tenants', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'unreachable' };
  }

  let tenantsBody: unknown = null;
  try {
    tenantsBody = await tenantsRes.json();
  } catch {
    tenantsBody = null;
  }

  const resolved = resolveOwnerTenantId({
    tenantSlug: input.tenantSlug,
    explicitTenantId: input.explicitTenantId,
    meTenantsStatus: tenantsRes.status,
    meTenantsBody: tenantsBody,
  });

  if (resolved.status === 'unauthorized') return { status: 'unauthorized' };
  if (resolved.status === 'unreachable') return { status: 'unreachable' };
  if (resolved.status === 'unresolved') return { status: 'tenant-unresolved' };

  let ticketsRes: Response;
  try {
    const qs = new URLSearchParams({ tenantId: resolved.tenantId });
    ticketsRes = await fetchImpl(`/api/bff/tickets?${qs}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { status: 'unreachable' };
  }

  if (ticketsRes.status === 401) return { status: 'unauthorized' };
  if (ticketsRes.status >= 500) return { status: 'unreachable' };

  let ticketsBody: unknown = null;
  try {
    ticketsBody = await ticketsRes.json();
  } catch {
    return { status: 'invalid' };
  }

  const list = parseMeTicketsResponse(ticketsRes.status, ticketsBody);
  if (!list) return { status: 'invalid' };

  const ticket = findTicketById(list.tickets, input.ticketId);
  if (!ticket) return { status: 'not-found' };
  return { status: 'ok', ticket };
}
