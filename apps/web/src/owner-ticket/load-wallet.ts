import { apiBaseUrl, ssrUpstreamGet } from '../bff/upstream';
import { readAccessToken } from '../oidc/cookies';
import { parseMeTenantsResponse } from '../nav/capabilities';
import { parseMeTicketsResponse } from './parse';
import type { LoadOwnerWalletResult } from './types';

const OWNER_WALLET_SSR_TIMEOUT_MS = 20_000;

function isTransientUpstreamStatus(status: number): boolean {
  return status === 502 || status === 503;
}

async function ownerWalletUpstreamGet(
  path: string,
  input?: {
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    accessToken?: string | null;
  },
): Promise<{ status: number; body: unknown }> {
  if (input?.fetchImpl) {
    const token = input.accessToken;
    if (!token) {
      return { status: 401, body: null };
    }
    const base = apiBaseUrl(input.env);
    try {
      const res = await input.fetchImpl(`${base}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    } catch {
      return { status: 502, body: null };
    }
  }

  try {
    return await ssrUpstreamGet(path, {
      timeoutMs: OWNER_WALLET_SSR_TIMEOUT_MS,
    });
  } catch {
    return { status: 502, body: null };
  }
}

/**
 * Server-side wallet load — GET /v1/me/tickets (all tenants) + me/tenants for slugs.
 * Production SSR uses {@link ssrUpstreamGet} (BFF-aligned bearer + timeout); tests inject fetchImpl.
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

  const tenantSlugById: Record<string, string> = {};
  let tenantsRes = await ownerWalletUpstreamGet('/v1/me/tenants', {
    ...input,
    accessToken: token,
  });
  if (isTransientUpstreamStatus(tenantsRes.status)) {
    tenantsRes = await ownerWalletUpstreamGet('/v1/me/tenants', {
      ...input,
      accessToken: token,
    });
  }

  if (tenantsRes.status === 401) return { status: 'unauthenticated' };
  if (tenantsRes.status >= 500) return { status: 'unreachable' };

  const parsedTenants = parseMeTenantsResponse(
    tenantsRes.status,
    tenantsRes.body,
  );
  if (tenantsRes.status === 200 && !parsedTenants) {
    return { status: 'invalid' };
  }
  for (const tenant of parsedTenants?.items ?? []) {
    tenantSlugById[tenant.tenantId.toLowerCase()] = tenant.slug.toLowerCase();
  }

  let ticketsRes = await ownerWalletUpstreamGet('/v1/me/tickets', {
    ...input,
    accessToken: token,
  });
  if (isTransientUpstreamStatus(ticketsRes.status)) {
    ticketsRes = await ownerWalletUpstreamGet('/v1/me/tickets', {
      ...input,
      accessToken: token,
    });
  }

  if (ticketsRes.status === 401) return { status: 'unauthenticated' };
  if (ticketsRes.status >= 500) return { status: 'unreachable' };
  if (ticketsRes.status < 200 || ticketsRes.status >= 300) {
    return { status: 'invalid' };
  }

  const tickets = parseMeTicketsResponse(ticketsRes.body);
  if (!tickets) return { status: 'invalid' };

  return { status: 'ok', tickets, tenantSlugById };
}
