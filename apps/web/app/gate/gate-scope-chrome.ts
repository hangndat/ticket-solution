import { forwardWithBearer } from '../../src/bff/upstream';
import {
  deriveNavCapabilities,
  parseMeEventsResponse,
  type NavCapabilities,
} from '../../src/nav/capabilities';
import type { MeEventItem } from '../../src/platform/contracts';
import { PLATFORM_PATHS } from '../../src/platform/contracts';

const GATE_CONFIRM_PERMISSION = 'gate.confirm';
const DISCOVERY_TIMEOUT_MS = 8_000;

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

export async function loadGateScopeChromeForPage(query: {
  tenantId?: string;
  eventId?: string;
}): Promise<{
  scope: GateScopeChrome | null;
  showGate: boolean;
}> {
  try {
    const upstream = await forwardWithBearer(
      PLATFORM_PATHS.meEvents,
      { method: 'GET' },
      { timeoutMs: DISCOVERY_TIMEOUT_MS, allowCookieRefresh: false },
    );
    let body: unknown = null;
    try {
      body = await upstream.json();
    } catch {
      body = null;
    }
    if (upstream.status === 401 || upstream.status >= 500) {
      return { scope: null, showGate: false };
    }
    const meEvents = parseMeEventsResponse(upstream.status, body);
    const caps: NavCapabilities = deriveNavCapabilities({
      authenticated: meEvents !== null,
      meEvents,
      meTenants: null,
      platformMe: null,
    });
    if (!caps.showGate || !meEvents) {
      return { scope: null, showGate: false };
    }
    const scope = resolveGateScopeChrome(meEvents.items, query);
    return { scope, showGate: true };
  } catch {
    return { scope: null, showGate: false };
  }
}
