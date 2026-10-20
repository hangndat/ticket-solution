import type { MeEventItem } from '@ticket/contracts';

/** Same permission gate as web `deriveNavCapabilities` showGate. */
export const GATE_CONFIRM_PERMISSION = 'gate.confirm';

export function gateStaffEvents(
  items: readonly MeEventItem[],
): MeEventItem[] {
  return items.filter((item) =>
    item.permissions.includes(GATE_CONFIRM_PERMISSION),
  );
}

export type StaffGateScope = {
  tenantId: string;
  eventId: string;
  name: string;
};

export function sameStaffGateScope(
  a: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
  b: Pick<StaffGateScope, 'tenantId' | 'eventId'>,
): boolean {
  return a.tenantId === b.tenantId && a.eventId === b.eventId;
}

export function meEventToScope(item: MeEventItem): StaffGateScope {
  return {
    tenantId: item.tenantId,
    eventId: item.eventId,
    name: item.name,
  };
}

/**
 * Restore persisted selection when still in MeEvents; otherwise first gate event.
 */
export function pickStaffGateScope(
  items: readonly MeEventItem[],
  persisted: StaffGateScope | null,
): StaffGateScope | null {
  const eligible = gateStaffEvents(items);
  if (eligible.length === 0) return null;
  if (persisted) {
    const match = eligible.find((item) => sameStaffGateScope(item, persisted));
    if (match) return meEventToScope(match);
  }
  return meEventToScope(eligible[0]);
}
