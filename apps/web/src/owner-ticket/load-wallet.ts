import { apiBaseUrl } from '../bff/upstream';
import { readAccessToken } from '../oidc/cookies';
import { parseMeTenantsResponse } from '../nav/capabilities';
import { parseMeTicketsResponse } from './parse';
import type { LoadOwnerWalletResult } from './types';

/**
 * Server-side wallet load — GET /v1/me/tickets (all tenants) + me/tenants for slugs.
 */
export async function loadOwnerWallet(input?: {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  accessToken?: string | null;
}): Promise<LoadOwnerWalletResult> {
  const token =
    input?.accessToken !== undefined
      ? input.accessToken
      : await readAccessToken();
  if (!token) return { status: 'unauthenticated' };

  const base = apiBaseUrl(input?.env);
  const fetchImpl = input?.fetchImpl ?? fetch;
  const authHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const tenantSlugById: Record<string, string> = {};
  try {
    const tenantsRes = await fetchImpl(`${base}/v1/me/tenants`, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });
    if (tenantsRes.status === 401) return { status: 'unauthenticated' };
    if (tenantsRes.status >= 500) return { status: 'unreachable' };

    let tenantsBody: unknown;
    try {
      tenantsBody = await tenantsRes.json();
    } catch {
      tenantsBody = null;
    }
    const parsedTenants = parseMeTenantsResponse(
      tenantsRes.status,
      tenantsBody,
    );
    if (tenantsRes.status === 200 && !parsedTenants) {
      return { status: 'invalid' };
    }
    for (const tenant of parsedTenants?.items ?? []) {
      tenantSlugById[tenant.tenantId.toLowerCase()] = tenant.slug.toLowerCase();
    }
  } catch {
    return { status: 'unreachable' };
  }

  try {
    const ticketsRes = await fetchImpl(`${base}/v1/me/tickets`, {
      method: 'GET',
      headers: authHeaders,
      cache: 'no-store',
    });
    if (ticketsRes.status === 401) return { status: 'unauthenticated' };
    if (ticketsRes.status >= 500) return { status: 'unreachable' };
    if (!ticketsRes.ok) return { status: 'invalid' };

    let json: unknown;
    try {
      json = await ticketsRes.json();
    } catch {
      return { status: 'invalid' };
    }

    const tickets = parseMeTicketsResponse(json);
    if (!tickets) return { status: 'invalid' };

    return { status: 'ok', tickets, tenantSlugById };
  } catch {
    return { status: 'unreachable' };
  }
}
