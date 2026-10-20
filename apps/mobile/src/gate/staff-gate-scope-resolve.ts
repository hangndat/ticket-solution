import { getEventId, getTenantId } from '../identity/config.ts';
import { isLocalDevPlaceholderGateScope } from './gate-fixture.ts';
import type { StaffGateScope } from './staff-gate-events.ts';

/**
 * Tenant/event for bare UUID scans: MeEvents selection first, then non-placeholder env.
 */
export function resolveGateScanFallback(
  selected: Pick<StaffGateScope, 'tenantId' | 'eventId'> | null | undefined,
): { tenantId: string | null; eventId: string | null } {
  if (selected?.tenantId && selected?.eventId) {
    return { tenantId: selected.tenantId, eventId: selected.eventId };
  }
  const tenantId = getTenantId();
  const eventId = getEventId();
  if (
    tenantId &&
    eventId &&
    !isLocalDevPlaceholderGateScope(tenantId, eventId)
  ) {
    return { tenantId, eventId };
  }
  return { tenantId: null, eventId: null };
}
