import { redirect } from 'next/navigation';
import { forwardWithBearer } from '../bff/upstream';
import {
  createGateSsrTrace,
  type GateSsrTrace,
} from './ssr-trace';
import { accessTokenIncludesAudience } from '../oidc/access-token-audience';
import { isAccessTokenStaleForSsr } from '../oidc/access-token-clock';
import { readOidcWebConfig } from '../oidc/config';
import { readAccessToken } from '../oidc/cookies';
import {
  redirectForSsrDiscovery401,
  redirectForSsrSessionRenewal,
} from '../oidc/session-refresh';
import { PLATFORM_PATHS } from '../bff/platform-contracts';
import {
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
} from './capabilities';

export type StaffRoute = '/admin' | '/gate';

/** Match SiteNav client discovery — avoid long route-level loading on SSR. */
const STAFF_DISCOVERY_TIMEOUT_MS = 8_000;

async function discoveryGet(
  path: string,
  trace?: GateSsrTrace,
): Promise<{ status: number; body: unknown }> {
  trace?.mark('discovery_get_start');
  const upstream = await forwardWithBearer(
    path,
    { method: 'GET' },
    {
      timeoutMs: STAFF_DISCOVERY_TIMEOUT_MS,
      trace,
      allowCookieRefresh: false,
    },
  );
  trace?.mark(`discovery_get_status_${upstream.status}`);
  let body: unknown = null;
  try {
    body = await upstream.json();
  } catch {
    body = null;
  }
  return { status: upstream.status, body };
}

function isTransientDiscoveryFailure(status: number): boolean {
  return status === 502 || status === 503;
}

/**
 * Soft-redirect anonymous deep-links on staff routes → /auth?next=…
 * Authenticated callers continue; capability checks run separately.
 */
export async function requireSessionOrAuth(
  nextPath: StaffRoute,
  trace?: GateSsrTrace,
): Promise<void> {
  trace?.mark('require_session_start');
  const token = await readAccessToken();
  const audience = readOidcWebConfig()?.audience ?? '';
  const audienceOk =
    Boolean(token) &&
    Boolean(audience) &&
    accessTokenIncludesAudience(token!, audience);
  if (
    token &&
    audienceOk &&
    !isAccessTokenStaleForSsr(token)
  ) {
    trace?.mark('require_session_access_ok');
    return;
  }
  trace?.mark(
    !token
      ? 'require_session_refresh_missing'
      : !audienceOk
        ? 'require_session_refresh_bad_audience'
        : 'require_session_refresh_stale',
  );
  trace?.mark('require_session_redirect_refresh_route');
  await redirectForSsrSessionRenewal(nextPath);
}

/**
 * Soft-redirect when discovery says the caller lacks Admin chrome.
 * Transient upstream/IdP failure → allow page render (mutations stay fail-closed).
 */
export async function requireAdminCapabilityOrHome(): Promise<void> {
  const [eventsRes, tenantsRes] = await Promise.all([
    discoveryGet(PLATFORM_PATHS.meEvents),
    discoveryGet(PLATFORM_PATHS.meTenants),
  ]);

  if (eventsRes.status === 401 || tenantsRes.status === 401) {
    await redirectForSsrDiscovery401('/admin');
  }

  if (
    isTransientDiscoveryFailure(eventsRes.status) ||
    isTransientDiscoveryFailure(tenantsRes.status)
  ) {
    return;
  }

  const meEvents = parseMeEventsResponse(eventsRes.status, eventsRes.body);
  const meTenants = parseMeTenantsResponse(tenantsRes.status, tenantsRes.body);
  const caps = deriveNavCapabilities({
    authenticated: meEvents !== null || meTenants !== null,
    meEvents,
    meTenants,
    platformMe: null,
  });

  if (!caps.showPortalStaff) {
    redirect('/?notice=admin_denied');
  }
}

/**
 * Soft-redirect when discovery says the caller lacks Gate chrome.
 * Transient upstream/IdP failure → allow gate shell (E01: no infinite loading).
 */
export async function requireGateCapabilityOrHome(
  trace?: GateSsrTrace,
): Promise<void> {
  trace?.mark('require_gate_capability_start');
  const eventsRes = await discoveryGet(PLATFORM_PATHS.meEvents, trace);

  if (eventsRes.status === 401) {
    trace?.mark('require_gate_capability_redirect_refresh');
    await redirectForSsrDiscovery401('/gate');
  }

  if (isTransientDiscoveryFailure(eventsRes.status)) {
    trace?.mark('require_gate_capability_transient_allow');
    return;
  }

  const meEvents = parseMeEventsResponse(eventsRes.status, eventsRes.body);
  const caps = deriveNavCapabilities({
    authenticated: meEvents !== null,
    meEvents,
    meTenants: null,
    platformMe: null,
  });

  if (!caps.showGate) {
    trace?.mark('require_gate_capability_denied');
    redirect('/?notice=gate_denied');
  }
  trace?.mark('require_gate_capability_allow');
}

/** Gate SSR: session + capability with optional GATE_SSR_TRACE=1 timing. */
export async function runGateStaffSsrGuards(): Promise<void> {
  const trace = createGateSsrTrace('gate_page');
  trace.mark('gate_page_start');
  await requireSessionOrAuth('/gate', trace);
  await requireGateCapabilityOrHome(trace);
  trace.finish('guards_ok');
}
