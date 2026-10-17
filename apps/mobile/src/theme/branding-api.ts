import { getApiBaseUrl } from '../identity/config.ts';
import { parseTenantBranding } from './parse.ts';
import type { BrandingFetchResult } from './types.ts';

async function parseResponse(
  response: Response,
): Promise<BrandingFetchResult> {
  if (response.status === 401 || response.status === 403) {
    return { status: 'unauthorized' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (response.status >= 500) return { status: 'unreachable' };
  if (!response.ok) return { status: 'invalid' };
  try {
    const json: unknown = await response.json();
    const branding = parseTenantBranding(json);
    if (!branding) return { status: 'invalid' };
    return { status: 'ok', branding };
  } catch {
    return { status: 'invalid' };
  }
}

/**
 * GET /v1/tenants/{tenantId}/branding (Bearer) — BE S1 (#122) authz path.
 * Deny-by-default outside membership; 401/403 → unauthorized (use cache/defaults).
 */
export async function fetchTenantBrandingById(
  tenantId: string,
  bearer: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<BrandingFetchResult> {
  const base = getApiBaseUrl();
  if (!base) return { status: 'misconfigured' };
  const id = tenantId.trim();
  const token = bearer.trim();
  if (!id || !token) return { status: 'invalid' };

  try {
    const response = await fetchImpl(
      `${base}/v1/tenants/${encodeURIComponent(id)}/branding`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal,
      },
    );
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

/**
 * GET /v1/public/tenants/{tenantSlug}/branding — public chrome path (web S2).
 * Used when app has a slug but no session; BE may land this alongside auth path.
 */
export async function fetchTenantBrandingBySlug(
  tenantSlug: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<BrandingFetchResult> {
  const base = getApiBaseUrl();
  if (!base) return { status: 'misconfigured' };
  const slug = tenantSlug.trim();
  if (!slug) return { status: 'invalid' };

  try {
    const response = await fetchImpl(
      `${base}/v1/public/tenants/${encodeURIComponent(slug)}/branding`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      },
    );
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

/**
 * Prefer authenticated tenantId fetch; fall back to public slug when no bearer.
 */
export async function fetchTenantBranding(opts: {
  tenantId?: string | null;
  tenantSlug?: string | null;
  bearer?: string | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<BrandingFetchResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const bearer = opts.bearer?.trim() ?? '';
  const tenantId = opts.tenantId?.trim() ?? '';
  const tenantSlug = opts.tenantSlug?.trim() ?? '';

  if (tenantId && bearer) {
    return fetchTenantBrandingById(
      tenantId,
      bearer,
      opts.signal,
      fetchImpl,
    );
  }
  if (tenantSlug) {
    return fetchTenantBrandingBySlug(tenantSlug, opts.signal, fetchImpl);
  }
  if (!getApiBaseUrl()) return { status: 'misconfigured' };
  return { status: 'invalid' };
}
