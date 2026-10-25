import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { isStaffPortalTenant } from '../onboarding';
import { patchPortalContextCache, type StorageLike } from './storage';

function tenantFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/([^/]+)/);
  return m?.[1] ?? null;
}

function eventFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/t\/[^/]+\/e\/([^/]+)/);
  return m?.[1] ?? null;
}

function isActiveStaffTenantId(
  tenantId: string,
  tenants: readonly MeTenantItem[],
): boolean {
  const tenant = tenants.find((t) => t.tenantId === tenantId);
  return Boolean(
    tenant && isStaffPortalTenant(tenant) && tenant.status === 'ACTIVE',
  );
}

/**
 * Sync cache from the current URL after discovery validated the membership.
 * Explicit deep links win — only persist what the route encodes.
 */
export function persistPortalContextFromRoute(input: {
  userId: string;
  pathname: string;
  tenants: readonly MeTenantItem[];
  events: readonly MeEventItem[];
  storage?: StorageLike | null;
}): void {
  const tenantId = tenantFromPath(input.pathname);
  if (!tenantId || !isActiveStaffTenantId(tenantId, input.tenants)) {
    return;
  }

  const pathEventId = eventFromPath(input.pathname);
  const eventValid =
    pathEventId &&
    input.events.some(
      (e) => e.tenantId === tenantId && e.eventId === pathEventId,
    );
  const tenantHomeOnly = /^\/t\/[^/]+\/?$/.test(input.pathname);

  patchPortalContextCache(
    input.userId,
    (current) => {
      const eventByTenant = { ...current.eventByTenant };
      if (pathEventId) {
        if (eventValid) {
          eventByTenant[tenantId] = pathEventId;
        }
      } else if (tenantHomeOnly) {
        // Tenant switcher or explicit event clear lands on org home — do not carry another tenant's event.
        eventByTenant[tenantId] = null;
      }

      const portalUsedTenants = current.portalUsedTenants.includes(tenantId)
        ? current.portalUsedTenants
        : [...current.portalUsedTenants, tenantId];

      return {
        ...current,
        tenantId,
        eventByTenant,
        portalUsedTenants,
      };
    },
    input.storage,
  );
}
