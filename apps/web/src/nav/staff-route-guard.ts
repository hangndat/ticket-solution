import { redirect } from 'next/navigation';
import { forwardWithBearer } from '../bff/upstream';
import { readAccessToken } from '../oidc/cookies';
import { refreshWebAccessToken } from '../oidc/refresh';
import { PLATFORM_PATHS } from '../platform/contracts';
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
): Promise<{ status: number; body: unknown }> {
  const upstream = await forwardWithBearer(
    path,
    { method: 'GET' },
    { timeoutMs: STAFF_DISCOVERY_TIMEOUT_MS },
  );
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
export async function requireSessionOrAuth(nextPath: StaffRoute): Promise<void> {
  const token = await readAccessToken();
  if (token) return;
  const refreshed = await refreshWebAccessToken();
  if (!refreshed.ok) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }
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
    redirect(`/auth?next=${encodeURIComponent('/admin')}`);
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

  if (!caps.showAdmin) {
    redirect('/?notice=admin_denied');
  }
}

/**
 * Soft-redirect when discovery says the caller lacks Gate chrome.
 * Transient upstream/IdP failure → allow gate shell (E01: no infinite loading).
 */
export async function requireGateCapabilityOrHome(): Promise<void> {
  const eventsRes = await discoveryGet(PLATFORM_PATHS.meEvents);

  if (eventsRes.status === 401) {
    redirect(`/auth?next=${encodeURIComponent('/gate')}`);
  }

  if (isTransientDiscoveryFailure(eventsRes.status)) {
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
    redirect('/?notice=gate_denied');
  }
}
