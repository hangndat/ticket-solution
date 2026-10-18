import { apiBaseUrl } from '../bff/upstream';
import { isUuid } from '../bff/ids';
import { isTenantSlug } from '../branding';
import { readAccessToken } from '../oidc/cookies';
import { parseOwnerTicketDetail } from './parse';
import type { LoadOwnerTicketResult } from './types';

/**
 * Server-side GET /v1/me/tickets/{ticketId}?tenantSlug=
 * Owner-auth only; never invents a ticket. Slug mismatch → not-found when BE
 * echoes tenantSlug (fail-closed, no PII).
 */
export async function loadOwnerTicket(input: {
  tenantSlug: string;
  ticketId: string;
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
  const url = new URL(
    `${base}/v1/me/tickets/${encodeURIComponent(ticketId)}`,
  );
  url.searchParams.set('tenantSlug', slug);

  const fetchImpl = input.fetchImpl ?? fetch;
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

    // Fail-closed tenant slug match when BE provides it.
    if (ticket.tenantSlug && ticket.tenantSlug !== slug) {
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
