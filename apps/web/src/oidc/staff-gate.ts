import { parseMeTenantsResponse } from '../nav/capabilities';
import type { MeTenantsResponse } from '../bff/platform-contracts';

/**
 * USER DECISION (2026-10-25): any account with a tenant staff membership
 * never uses the attendee web app. D13 also adds ticket-owner tenants with
 * role=Attendee to GET /v1/me/tenants, so only a real staff role counts.
 * `unknown` must never create or continue an attendee session.
 */
export type StaffStatus = 'staff' | 'attendee' | 'unknown';

const STAFF_ROLES = new Set([
  'Owner',
  'Manager',
  'CS',
  'Supervisor',
  'Scanner',
]);
const TENANT_STATUSES = new Set(['PENDING', 'ACTIVE', 'SUSPENDED']);

export function isStaffMembership(
  meTenants: MeTenantsResponse | null,
): boolean {
  return meTenants?.items.some((item) => STAFF_ROLES.has(item.role)) ?? false;
}

/** Pure decision from a `/v1/me/tenants` response — no I/O. */
export function decideStaffStatus(status: number, body: unknown): StaffStatus {
  const parsed = parseMeTenantsResponse(status, body);
  if (parsed === null) return 'unknown';
  if (
    parsed.items.some(
      (item) =>
        !item.tenantId.trim() ||
        !item.slug.trim() ||
        !item.name.trim() ||
        !TENANT_STATUSES.has(item.status) ||
        (item.role === 'Attendee' && item.tenantPermissions.length > 0) ||
        (item.role !== 'Attendee' && !STAFF_ROLES.has(item.role)),
    )
  )
    return 'unknown';
  return isStaffMembership(parsed) ? 'staff' : 'attendee';
}

/** Only a separate, non-downgraded portal origin is safe for SSO handoff. */
export function staffPortalLoginUrl(
  webOrigin: string,
  portalOrigin: string | null,
): string | null {
  if (!portalOrigin) return null;
  try {
    const web = new URL(webOrigin);
    const portal = new URL(portalOrigin);
    if (
      portal.hostname === web.hostname ||
      (web.protocol === 'https:' && portal.protocol !== 'https:')
    ) {
      return null;
    }
    return `${portal.origin}/api/auth/login`;
  } catch {
    return null;
  }
}

/**
 * Attendee-only surfaces (wallet/account/redeem/claim/invite) — a staff
 * session must never render these; catalog/marketing paths stay public.
 */
export const CONSUMER_AUTH_PATH_PREFIXES = [
  '/wallet',
  '/account',
  '/redeem',
  '/claim',
  '/invite',
  '/api/bff/claim',
  '/api/bff/redeem',
  '/api/bff/redemptions',
  '/api/bff/tickets',
  '/api/bff/operations',
  '/api/bff/me/account-deletion-requests',
  '/api/bff/me/membership-invites/accept',
] as const;

export function isConsumerAuthenticatedPath(pathname: string): boolean {
  if (/^\/t\/[^/]+\/tickets\/[^/]+\/?$/.test(pathname)) return true;
  return CONSUMER_AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function fetchStaffStatus(input: {
  accessToken: string;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<StaffStatus> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${input.apiBaseUrl}/v1/me/tenants`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(input.timeoutMs ?? 5_000),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return decideStaffStatus(response.status, body);
  } catch {
    return 'unknown';
  }
}
