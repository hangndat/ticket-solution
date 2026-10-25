import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { isStaffPortalTenant } from '../onboarding';
import type { PortalContextCache, ValidatedPortalContext } from './types';

function isActiveStaffTenant(
  tenantId: string,
  tenants: readonly MeTenantItem[],
): MeTenantItem | null {
  const tenant = tenants.find((t) => t.tenantId === tenantId) ?? null;
  if (!tenant || !isStaffPortalTenant(tenant)) return null;
  if (tenant.status !== 'ACTIVE') return null;
  return tenant;
}

function eventExistsForTenant(
  tenantId: string,
  eventId: string,
  events: readonly MeEventItem[],
): boolean {
  return events.some(
    (e) => e.tenantId === tenantId && e.eventId === eventId,
  );
}

/**
 * Validate cached IDs against discovery — cache never grants access.
 */
export function validatePortalContextCache(input: {
  cache: PortalContextCache;
  tenants: readonly MeTenantItem[];
  events: readonly MeEventItem[];
}): ValidatedPortalContext | null {
  const tenantId = input.cache.tenantId?.trim();
  if (!tenantId) return null;

  const staffTenants = input.tenants.filter(isStaffPortalTenant);
  const tenant = isActiveStaffTenant(tenantId, staffTenants);
  if (!tenant) return null;

  const eventEntry = input.cache.eventByTenant[tenantId];
  if (eventEntry === undefined) {
    return { tenantId, eventId: null };
  }
  if (eventEntry === null) {
    return { tenantId, eventId: null };
  }
  const eventId = eventEntry.trim();
  if (!eventId || !eventExistsForTenant(tenantId, eventId, input.events)) {
    return { tenantId, eventId: null };
  }
  return { tenantId, eventId };
}

export function cachedEventForTenant(input: {
  cache: PortalContextCache;
  tenantId: string;
  tenants: readonly MeTenantItem[];
  events: readonly MeEventItem[];
}): string | null {
  if (!isActiveStaffTenant(input.tenantId, input.tenants)) return null;
  const entry = input.cache.eventByTenant[input.tenantId];
  if (entry === undefined || entry === null) return null;
  const eventId = entry.trim();
  if (!eventId) return null;
  if (!eventExistsForTenant(input.tenantId, eventId, input.events)) {
    return null;
  }
  return eventId;
}

export function portalPathForContext(ctx: ValidatedPortalContext): string {
  if (ctx.eventId) {
    return `/t/${encodeURIComponent(ctx.tenantId)}/e/${encodeURIComponent(ctx.eventId)}`;
  }
  return `/t/${encodeURIComponent(ctx.tenantId)}`;
}
