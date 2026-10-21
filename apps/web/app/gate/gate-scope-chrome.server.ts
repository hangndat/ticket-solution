import { forwardWithBearer } from '../../src/bff/upstream';
import {
  deriveNavCapabilities,
  parseMeEventsResponse,
  type NavCapabilities,
} from '../../src/nav/capabilities';
import { PLATFORM_PATHS } from '../../src/platform/contracts';
import { resolveGateScopeChrome, type GateScopeChrome } from './gate-scope-chrome';

const DISCOVERY_TIMEOUT_MS = 8_000;

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
