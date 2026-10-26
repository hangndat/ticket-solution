import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import type { OnboardingSurface } from '../onboarding';
import { isStaffPortalTenant } from '../onboarding';
import { canPerformTenantAction, firstAllowedTenantPath } from './capability-policy';

/** Resolve the home entry from discovered grants and onboarding state. */
export function resolveHomeEntry(
  surface: Exclude<OnboardingSurface, { kind: 'signup' | 'customer' }>,
  tenants: readonly MeTenantItem[],
  events: readonly MeEventItem[],
): string | null {
  if (surface.kind === 'pending-activation') {
    return `/onboarding/${surface.tenant.tenantId}`;
  }

  const tenantPermissions = surface.tenant.tenantPermissions;
  const canCompleteFirstRun =
    canPerformTenantAction('editSettings', tenantPermissions) &&
    canPerformTenantAction('manageMembers', tenantPermissions) &&
    canPerformTenantAction('createEvent', tenantPermissions);
  if (surface.kind === 'first-run' && canCompleteFirstRun) {
    return `/onboarding/${surface.tenant.tenantId}`;
  }

  return [
    surface.tenant,
    ...tenants.filter(
      (tenant) =>
        isStaffPortalTenant(tenant) &&
        tenant.tenantId !== surface.tenant.tenantId,
    ),
  ]
    .map((tenant) => firstAllowedTenantPath(tenant, events))
    .find((path) => path !== null) ?? null;
}
