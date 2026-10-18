import { apiBaseUrl } from '../bff/upstream';
import { isUuid } from '../bff/ids';
import { isTenantSlug } from '../branding';
import { readAccessToken } from '../oidc/cookies';
import { parseOwnerTicketDetail } from './parse';
import { resolveOwnerTenantId } from './resolve';
import type { LoadOwnerTicketResult } from './types';

/**
 * Server-side owner ticket load for email deeplink `/t/{slug}/tickets/{id}`.
 * Resolves slug→tenantId via me/tenants (or explicit ?tenantId=), then
 * GET /v1/me/tickets/{ticketId}?tenantId= (UUID) — contract PR #400.
 */
export async function loadOwnerTicket(input: {
  tenantSlug: string;
  ticketId: string;
  explicitTenantId?: string | null;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  accessToken?: string | null;
}): Promise<LoadOwnerTicketResult> {
  const slug = input.tenantSlug.trim().toLowerCase();
  const ticketId = input.ticketId.trim();
  if (!slug || !isTenantSlug(slug) || !isUuid(ticketId)) {
    return { status: 'invalid' };
  }

  const token =
    input.accessToken !== undefined
      ? input.accessToken
      : await readAccessToken();
  if (!token) return { status: 'unauthenticated' };

  const base = apiBaseUrl(input.env);
  const fetchImpl = input.fetchImpl ?? fetch;

  let resolved: ReturnType<typeof resolveOwnerTenantId>;
  const explicit = input.explicitTenantId?.trim() ?? '';
  if (isUuid(explicit)) {
    resolved = { status: 'ok', tenantId: explicit, source: 'query' };
  } else {
    let tenantsStatus: number;
    let tenantsBody: unknown;
    try {
      const tenantsRes = await fetchImpl(`${base}/v1/me/tenants`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      tenantsStatus = tenantsRes.status;
      if (tenantsStatus === 401) return { status: 'unauthenticated' };
      try {
        tenantsBody = await tenantsRes.json();
      } catch {
        tenantsBody = null;
      }
    } catch {
      return { status: 'unreachable' };
    }

    resolved = resolveOwnerTenantId({
      tenantSlug: slug,
      explicitTenantId: input.explicitTenantId,
      meTenantsStatus: tenantsStatus,
      meTenantsBody: tenantsBody,
    });
  }

  if (resolved.status === 'unauthorized') return { status: 'unauthenticated' };
  if (resolved.status === 'unreachable') return { status: 'unreachable' };
  if (resolved.status === 'unresolved') return { status: 'tenant-unresolved' };

  const url = new URL(
    `${base}/v1/me/tickets/${encodeURIComponent(ticketId)}`,
  );
  url.searchParams.set('tenantId', resolved.tenantId);

  try {
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (response.status === 401) return { status: 'unauthenticated' };
    if (response.status === 403) return { status: 'forbidden' };
    if (response.status === 404) return { status: 'not-found' };
    if (response.status >= 500) return { status: 'unreachable' };
    if (!response.ok) return { status: 'invalid' };

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { status: 'invalid' };
    }

    const ticket = parseOwnerTicketDetail(json);
    if (!ticket) return { status: 'invalid' };

    if (ticket.tenantId.toLowerCase() !== resolved.tenantId.toLowerCase()) {
      return { status: 'not-found' };
    }
    if (ticket.ticketId.toLowerCase() !== ticketId.toLowerCase()) {
      return { status: 'not-found' };
    }

    return { status: 'ok', ticket };
  } catch {
    return { status: 'unreachable' };
  }
}
