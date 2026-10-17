import { brandingApiBaseUrl } from './api-base';
import { parseTenantBranding } from './parse';
import type { TenantBranding } from './types';
import { VEMOKI_BRANDING } from './vemoki';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function isTenantSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Load public tenant branding from Nest.
 * Path convention (D8-S1 #122, parallel): GET /v1/public/tenants/{slug}/branding
 * Any network / non-2xx / invalid body → Vemoki default (never throw to chrome).
 */
export async function loadTenantBranding(
  tenantSlug: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<TenantBranding> {
  const slug = tenantSlug?.trim().toLowerCase() ?? '';
  if (!slug || !isTenantSlug(slug)) {
    return VEMOKI_BRANDING;
  }

  const base = brandingApiBaseUrl(env);
  const url = `${base}/v1/public/tenants/${encodeURIComponent(slug)}/branding`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ...VEMOKI_BRANDING, tenantSlug: slug };
    }
    const json: unknown = await res.json();
    const parsed = parseTenantBranding(json);
    if (!parsed) {
      return { ...VEMOKI_BRANDING, tenantSlug: slug };
    }
    return {
      ...parsed,
      tenantSlug: parsed.tenantSlug ?? slug,
      source: 'tenant',
    };
  } catch {
    return { ...VEMOKI_BRANDING, tenantSlug: slug };
  }
}

/** Resolve branding for chrome: optional slug, else platform Vemoki. */
export async function resolveSurfaceBranding(
  tenantSlug?: string | null,
): Promise<TenantBranding> {
  if (!tenantSlug?.trim()) return VEMOKI_BRANDING;
  return loadTenantBranding(tenantSlug);
}
