import { redirect } from 'next/navigation';
import { apiBaseUrl } from '../bff/upstream';
import { readAccessToken } from '../oidc/cookies';
import { PLATFORM_PATHS } from '../platform/contracts';
import {
  deriveNavCapabilities,
  parseMeEventsResponse,
  parseMeTenantsResponse,
} from './capabilities';

export type StaffRoute = '/admin' | '/gate';

async function fetchJsonWithBearer(
  token: string,
  path: string,
): Promise<{ status: number; body: unknown }> {
  const base = apiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    let body: unknown = null;
    try {
      body = await upstream.json();
    } catch {
      body = null;
    }
    return { status: upstream.status, body };
  } catch {
    return { status: 502, body: null };
  }
}

/**
 * Soft-redirect anonymous deep-links on staff routes → /auth?next=…
 * Authenticated callers continue; capability checks run separately.
 */
export async function requireSessionOrAuth(nextPath: StaffRoute): Promise<string> {
  const token = await readAccessToken();
  if (!token) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }
  return token;
}

/**
 * Soft-redirect when discovery says the caller lacks Admin chrome.
 * Network/parse failure → deny (fail-closed), home with notice.
 */
export async function requireAdminCapabilityOrHome(token: string): Promise<void> {
  const [eventsRes, tenantsRes] = await Promise.all([
    fetchJsonWithBearer(token, PLATFORM_PATHS.meEvents),
    fetchJsonWithBearer(token, PLATFORM_PATHS.meTenants),
  ]);

  if (eventsRes.status === 401 || tenantsRes.status === 401) {
    redirect(`/auth?next=${encodeURIComponent('/admin')}`);
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
 */
export async function requireGateCapabilityOrHome(token: string): Promise<void> {
  const eventsRes = await fetchJsonWithBearer(token, PLATFORM_PATHS.meEvents);

  if (eventsRes.status === 401) {
    redirect(`/auth?next=${encodeURIComponent('/gate')}`);
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
