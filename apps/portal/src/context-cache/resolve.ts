import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { resolveOnboardingSurface } from '../onboarding';
import type { PortalContextCache } from './types';
import {
  portalPathForContext,
  validatePortalContextCache,
} from './validate';

export type HomeDestination =
  | { kind: 'redirect'; path: string }
  | { kind: 'customer' }
  | { kind: 'signup' };

export function resolveHomeDestination(input: {
  userId: string | null;
  tenants: readonly MeTenantItem[] | null | undefined;
  events: readonly MeEventItem[] | null | undefined;
  cache: PortalContextCache | null;
}): HomeDestination {
  const events = input.events ?? [];
  const tenants = input.tenants ?? [];

  if (input.userId?.trim() && input.cache) {
    const validated = validatePortalContextCache({
      cache: input.cache,
      tenants,
      events,
    });
    if (validated) {
      return { kind: 'redirect', path: portalPathForContext(validated) };
    }
  }

  const surface = resolveOnboardingSurface({
    tenants,
    userId: input.userId,
    eventCountForTenant: (tenantId) =>
      events.filter((e) => e.tenantId === tenantId).length,
  });

  if (surface.kind === 'customer') return { kind: 'customer' };
  if (surface.kind === 'signup') return { kind: 'signup' };

  const tenantId = surface.tenant.tenantId;
  if (surface.kind === 'pending-activation' || surface.kind === 'first-run') {
    const used =
      input.cache?.portalUsedTenants.includes(tenantId) === true &&
      surface.tenant.status === 'ACTIVE';
    if (used) {
      return {
        kind: 'redirect',
        path: `/t/${encodeURIComponent(tenantId)}`,
      };
    }
    return {
      kind: 'redirect',
      path: `/onboarding/${encodeURIComponent(tenantId)}`,
    };
  }

  return {
    kind: 'redirect',
    path: `/t/${encodeURIComponent(tenantId)}`,
  };
}
