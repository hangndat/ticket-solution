import { isAppScheme } from '../identity/app-schemes.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,80}$/;
/** Opaque claim token — length-bounded; never logged by callers. */
const CLAIM_TOKEN = /^[A-Za-z0-9._~-]{16,512}$/;

export type InstalledAppLink =
  | { kind: 'ticket'; ticketId: string; href: string }
  | { kind: 'event'; eventId: string; href: string }
  | {
      kind: 'invitation-claim';
      token: string;
      tenantId: string;
      eventId: string;
      tenantSlug?: string;
      eventSlug?: string;
      href: string;
    }
  /** Headless sim-uat only: bearer still verified via GET /v1/me (never stubs identity). */
  | { kind: 'uat-staff-session'; accessToken: string; href: string }
  /** Headless sim-uat only: submit gate scan without HID TextInput. */
  | {
      kind: 'uat-scan';
      ticketId: string;
      preferOffline: boolean;
      href: string;
    }
  | { kind: 'oauth-callback' }
  | { kind: 'passthrough' };

/**
 * Classify an installed-app URL before Expo Router sees it.
 * `vemoki://oauth/callback` and `ticketsolution://oauth/callback` stay auth
 * redirects (router must not navigate). Ticket and event links rewrite onto
 * existing screens. Fixture event ids (e.g. `demo-fun-fest`) are preserved.
 * Invitation claim links never fall back to fixture routes.
 */
export function parseInstalledAppLink(input: string): InstalledAppLink {
  const raw = input.trim();
  if (!raw) return { kind: 'passthrough' };

  const claim = parseInvitationClaimLink(raw);
  if (claim) return claim;

  const uatSession = parseUatStaffSessionLink(raw);
  if (uatSession) return uatSession;

  const uatScan = parseUatScanLink(raw);
  if (uatScan) return uatScan;

  const segments = linkSegments(raw);
  if (!segments) return { kind: 'passthrough' };
  if (segments.oauthCallback) return { kind: 'oauth-callback' };

  const [head, id, extra] = segments.parts;
  if (extra !== undefined) return { kind: 'passthrough' };
  if (!head || !id) return { kind: 'passthrough' };

  if (head.toLowerCase() === 'tickets' && UUID.test(id)) {
    return { kind: 'ticket', ticketId: id, href: `/my-tickets/${id}` };
  }
  if (head.toLowerCase() === 'events' && EVENT_ID.test(id)) {
    return {
      kind: 'event',
      eventId: id,
      href: `/events/fixture/${encodeURIComponent(id)}`,
    };
  }
  return { kind: 'passthrough' };
}

/**
 * Expo Router `redirectSystemPath` result.
 * `null` leaves navigation alone so the OAuth callback can finish.
 */
export function routeForInstalledAppLink(input: string): string | null {
  const parsed = parseInstalledAppLink(input);
  if (parsed.kind === 'oauth-callback') return null;
  if (
    parsed.kind === 'ticket' ||
    parsed.kind === 'event' ||
    parsed.kind === 'invitation-claim' ||
    parsed.kind === 'uat-staff-session' ||
    parsed.kind === 'uat-scan'
  ) {
    return parsed.href;
  }
  return input;
}

/**
 * Headless sim-uat bootstrap (Debug / `__DEV__` screen enforces gate):
 * `vemoki://uat/staff-session?access_token=<Keycloak JWT>`
 * Token must still pass SessionBoundary.establish → verifyViaMe.
 */
function parseUatStaffSessionLink(raw: string): InstalledAppLink | null {
  let url: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(raw);
      if (!isAppScheme(url.protocol)) return null;
    } else {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(`ticketsolution://host${path}`);
    }
  } catch {
    return null;
  }

  const parts = [
    url.hostname,
    ...url.pathname.split('/').filter((p) => p.length > 0),
  ].filter((p) => p && p !== 'host');

  if (
    parts.length !== 2 ||
    parts[0]?.toLowerCase() !== 'uat' ||
    parts[1]?.toLowerCase() !== 'staff-session'
  ) {
    return null;
  }

  const accessToken = url.searchParams.get('access_token')?.trim() ?? '';
  // JWT shape + length bound; never log the token.
  if (
    accessToken.length < 32 ||
    accessToken.length > 8192 ||
    accessToken.split('.').length !== 3
  ) {
    return { kind: 'passthrough' };
  }

  const qs = new URLSearchParams({ access_token: accessToken });
  return {
    kind: 'uat-staff-session',
    accessToken,
    href: `/uat/staff-session?${qs.toString()}`,
  };
}

/** `vemoki://uat/scan?ticketId=<uuid>&preferOffline=1` */
function parseUatScanLink(raw: string): InstalledAppLink | null {
  let url: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(raw);
      if (!isAppScheme(url.protocol)) return null;
    } else {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(`ticketsolution://host${path}`);
    }
  } catch {
    return null;
  }

  const parts = [
    url.hostname,
    ...url.pathname.split('/').filter((p) => p.length > 0),
  ].filter((p) => p && p !== 'host');

  if (
    parts.length !== 2 ||
    parts[0]?.toLowerCase() !== 'uat' ||
    parts[1]?.toLowerCase() !== 'scan'
  ) {
    return null;
  }

  const ticketId = url.searchParams.get('ticketId')?.trim() ?? '';
  if (!UUID.test(ticketId)) return { kind: 'passthrough' };
  const preferOffline = url.searchParams.get('preferOffline') === '1';
  const qs = new URLSearchParams({ ticketId });
  if (preferOffline) qs.set('preferOffline', '1');
  return {
    kind: 'uat-scan',
    ticketId,
    preferOffline,
    href: `/uat/scan?${qs.toString()}`,
  };
}

/**
 * Guest claim deep links (C-I):
 * - `vemoki://invitations/claim?token=&tenantId=&eventId=`
 * - path `/invitations/claim` with the same query
 * Token stays in query for the claim screen; not written to fixture routes.
 */
function parseInvitationClaimLink(raw: string): InstalledAppLink | null {
  let url: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(raw);
      if (!isAppScheme(url.protocol)) return null;
    } else {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(`ticketsolution://host${path}`);
    }
  } catch {
    return null;
  }

  const parts = [
    url.hostname,
    ...url.pathname.split('/').filter((p) => p.length > 0),
  ].filter((p) => p && p !== 'host');

  const invitationsIdx = parts.findIndex(
    (p) => p.toLowerCase() === 'invitations',
  );
  if (invitationsIdx < 0) return null;
  const claimPart = parts[invitationsIdx + 1];
  if (!claimPart || claimPart.toLowerCase() !== 'claim') return null;
  if (parts[invitationsIdx + 2] !== undefined) return null;

  const token = url.searchParams.get('token')?.trim() ?? '';
  const tenantId = url.searchParams.get('tenantId')?.trim() ?? '';
  const eventId = url.searchParams.get('eventId')?.trim() ?? '';
  const tenantSlug = url.searchParams.get('tenantSlug')?.trim() || undefined;
  const eventSlug = url.searchParams.get('eventSlug')?.trim() || undefined;

  if (!CLAIM_TOKEN.test(token) || !UUID.test(tenantId) || !UUID.test(eventId)) {
    return { kind: 'passthrough' };
  }

  const qs = new URLSearchParams({
    token,
    tenantId,
    eventId,
  });
  if (tenantSlug) qs.set('tenantSlug', tenantSlug);
  if (eventSlug) qs.set('eventSlug', eventSlug);

  return {
    kind: 'invitation-claim',
    token,
    tenantId,
    eventId,
    tenantSlug,
    eventSlug,
    href: `/claim?${qs.toString()}`,
  };
}

function linkSegments(
  raw: string,
): { parts: string[]; oauthCallback: boolean } | null {
  let host = '';
  let pathname = '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    if (!isAppScheme(url.protocol)) return null;
    host = url.hostname;
    pathname = url.pathname;
  } else {
    const pathOnly = raw.split(/[?#]/)[0] ?? '';
    pathname = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  }
  const pathParts = pathname.split('/').filter((part) => part.length > 0);
  const parts = host ? [host, ...pathParts] : pathParts;
  const oauthCallback =
    parts.length >= 2 &&
    parts[0]?.toLowerCase() === 'oauth' &&
    parts[1]?.toLowerCase() === 'callback' &&
    parts.length === 2;
  return { parts, oauthCallback };
}
