import type { MeEventItem } from '../../src/bff/platform-contracts';

const GATE_CONFIRM_PERMISSION = 'gate.confirm';

export type GateScopeChrome = {
  eventId: string;
  tenantId: string;
  eventName: string;
};

export const DEFAULT_GATE_LABEL = 'Cổng chính';

function gateStaffEvents(items: readonly MeEventItem[]): MeEventItem[] {
  return items.filter((item) =>
    item.permissions.includes(GATE_CONFIRM_PERMISSION),
  );
}

/**
 * First gate-eligible MeEvents row — matches mobile pickStaffGateScope default.
 */
export function pickGateScopeChrome(
  items: readonly MeEventItem[],
): GateScopeChrome | null {
  const eligible = gateStaffEvents(items);
  const first = eligible[0];
  if (!first) return null;
  return {
    tenantId: first.tenantId,
    eventId: first.eventId,
    eventName: first.name,
  };
}

function matchScopeFromIds(
  items: readonly MeEventItem[],
  tenantId: string,
  eventId: string,
): GateScopeChrome | null {
  const tid = tenantId.trim();
  const eid = eventId.trim();
  if (!tid || !eid) return null;
  const eligible = gateStaffEvents(items);
  const match = eligible.find(
    (item) => item.tenantId === tid && item.eventId === eid,
  );
  if (!match) return null;
  return {
    tenantId: match.tenantId,
    eventId: match.eventId,
    eventName: match.name,
  };
}

export function resolveGateScopeChrome(
  items: readonly MeEventItem[],
  query: { tenantId?: string; eventId?: string },
): GateScopeChrome | null {
  const fromQuery = matchScopeFromIds(
    items,
    query.tenantId ?? '',
    query.eventId ?? '',
  );
  if (fromQuery) return fromQuery;
  return pickGateScopeChrome(items);
}
