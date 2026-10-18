import { isUuid } from '../bff/ids';
import { parseMeTenantsResponse } from '../nav/capabilities';

/**
 * Resolve tenant UUID for owner ticket load.
 * Prefer explicit tenantId (optional query); else match slug on me/tenants.
 * Never invent a public slug→UUID map.
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
  if (isUuid(explicit)) {
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
