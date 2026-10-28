/**
 * ADR-20 + O16 PORTAL-SEPARATE-APP: ticket-web (app.vemoki.com) is attendee.
 * Staff who complete OIDC here bounce to PORTAL_ORIGIN (ticket-admin-web).
 * Host-only cookies — do not copy BFF session; IdP SSO may skip password, not MFA.
 */

import { PLATFORM_PATHS } from '../bff/platform-contracts';
import { apiBaseUrl } from '../bff/upstream';
import { parseMeEventsResponse } from '../nav/capabilities';
import { portalOriginFromEnv, type DualRunEnv } from '../portal/dual-run';

export function portalStaffLoginLocation(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/auth/login`;
}

export type TicketWebPostLogin =
  | { kind: 'portal'; location: string }
  | { kind: 'app'; path: string };

/**
 * staffEligible true + valid PORTAL_ORIGIN → portal login.
 * Lookup miss/false → attendee path (B06: do not send attendees to portal).
 */
export function decideTicketWebPostLogin(input: {
  staffEligible: boolean | null;
  portalOrigin: string | null;
  attendeePath: string;
}): TicketWebPostLogin {
  if (input.staffEligible === true && input.portalOrigin) {
    return {
      kind: 'portal',
      location: portalStaffLoginLocation(input.portalOrigin),
    };
  }
  return { kind: 'app', path: input.attendeePath };
}

export function portalOriginForStaffBounce(
  env: DualRunEnv = process.env,
): string | null {
  return portalOriginFromEnv(env);
}

export async function lookupStaffEligible(
  accessToken: string,
  opts?: {
    fetchImpl?: typeof fetch;
    apiBase?: string;
    timeoutMs?: number;
  },
): Promise<boolean | null> {
  if (!accessToken) return null;
  const base = (opts?.apiBase ?? apiBaseUrl()).replace(/\/$/, '');
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 4_000;
  try {
    const res = await fetchImpl(`${base}${PLATFORM_PATHS.meEvents}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body: unknown = await res.json().catch(() => null);
    const parsed = parseMeEventsResponse(res.status, body);
    if (!parsed) return null;
    return parsed.staffEligible;
  } catch {
    return null;
  }
}
