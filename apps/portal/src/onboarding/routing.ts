/**
 * Route decisions for PS5 — PENDING wait vs first-run vs normal portal.
 */

import type { MeTenantItem } from '@ticket/contracts';
import { isPendingActivationStatus } from './registration';
import {
  readOnboardingProgress,
  shouldShowFirstRun,
  type OnboardingProgress,
} from './progress';

export type OnboardingSurface =
  | { kind: 'signup' }
  | { kind: 'pending-activation'; tenant: MeTenantItem }
  | {
      kind: 'first-run';
      tenant: MeTenantItem;
      progress: OnboardingProgress;
      hasEvent: boolean;
    }
  | { kind: 'portal'; tenant: MeTenantItem };

export function pickPrimaryTenant(
  items: readonly MeTenantItem[] | null | undefined,
): MeTenantItem | null {
  if (!items?.length) return null;
  // Prefer PENDING self-serve wait, then ACTIVE Owner, else first.
  const pending = items.find((t) => isPendingActivationStatus(t.status));
  if (pending) return pending;
  const activeOwner = items.find(
    (t) => t.status === 'ACTIVE' && t.role === 'Owner',
  );
  if (activeOwner) return activeOwner;
  return items[0] ?? null;
}

export function resolveOnboardingSurface(input: {
  tenants: readonly MeTenantItem[] | null | undefined;
  userId: string | null;
  eventCountForTenant: (tenantId: string) => number;
}): OnboardingSurface {
  const tenant = pickPrimaryTenant(input.tenants);
  if (!tenant) return { kind: 'signup' };

  if (isPendingActivationStatus(tenant.status)) {
    return { kind: 'pending-activation', tenant };
  }

  if (tenant.status === 'ACTIVE') {
    const hasEvent = input.eventCountForTenant(tenant.tenantId) > 0;
    const progress = readOnboardingProgress(input.userId, tenant.tenantId);
    if (shouldShowFirstRun({ tenantStatus: tenant.status, progress, hasEvent })) {
      return { kind: 'first-run', tenant, progress, hasEvent };
    }
  }

  return { kind: 'portal', tenant };
}

/** Home / tenant deep-link target after discovery. */
export function onboardingPathForTenant(tenant: MeTenantItem): string {
  if (isPendingActivationStatus(tenant.status)) {
    return `/onboarding/${encodeURIComponent(tenant.tenantId)}`;
  }
  return `/onboarding/${encodeURIComponent(tenant.tenantId)}`;
}

export function portalPathForTenant(tenantId: string): string {
  return `/t/${encodeURIComponent(tenantId)}`;
}
