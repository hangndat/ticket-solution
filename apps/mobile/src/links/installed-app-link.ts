import { isAppScheme } from '../identity/app-schemes.ts';
import { ATTENDEE_REDEEM_PATH } from '../navigation/attendee-redeem-entry.ts';
import {
  extractMembershipInviteTokenFromUrl,
  isMembershipInviteToken,
} from './membership-invite-url.ts';

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
  | { kind: 'staff-access'; href: string }
  | {
      kind: 'membership-invite';
      token: string;
      href: string;
    }
  | { kind: 'uat-session'; href: string }
  | { kind: 'redeem-entry'; href: string }
  | { kind: 'oauth-callback' }
  | { kind: 'passthrough' };

/**
 * Classify an installed-app URL before Expo Router sees it.
 * `vemoki://oauth/callback` and `ticketsolution://oauth/callback` stay auth
 * redirects (router must not navigate). Ticket and event links rewrite onto
 * existing screens. Fixture event ids (e.g. `demo-mfest`) are preserved.
 * Invitation claim links never fall back to fixture routes.
 */
export function parseInstalledAppLink(input: string): InstalledAppLink {
  const raw = input.trim();
  if (!raw) return { kind: 'passthrough' };

  const claim = parseInvitationClaimLink(raw);
  if (claim) return claim;

  const membershipInvite = parseMembershipInviteLink(raw);
  if (membershipInvite) return membershipInvite;

  const uatSession = parseUatSessionLink(raw);
  if (uatSession) return uatSession;

  const segments = linkSegments(raw);
  if (!segments) return { kind: 'passthrough' };
  if (segments.oauthCallback) return { kind: 'oauth-callback' };

  const [head, id, extra] = segments.parts;
  if (extra !== undefined) return { kind: 'passthrough' };
  if (!head) return { kind: 'passthrough' };

  // O02: staff deep links always land on soft-access (deny or tab), never assume tab chrome.
  if (head.toLowerCase() === 'staff' && id === undefined) {
    return { kind: 'staff-access', href: '/staff-access' };
  }

  if (head.toLowerCase() === 'redeem' && id === undefined) {
    return { kind: 'redeem-entry', href: ATTENDEE_REDEEM_PATH };
  }

  if (!id) return { kind: 'passthrough' };

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
    parsed.kind === 'staff-access' ||
    parsed.kind === 'membership-invite' ||
    parsed.kind === 'uat-session' ||
    parsed.kind === 'redeem-entry'
  ) {
    return parsed.href;
  }
  return input;
}

/**
 * __DEV__ sim-uat helper: `vemoki://uat/session?access_token=…`
 * Route still refuse outside __DEV__ (see `app/uat/session.tsx`).
 */
function parseUatSessionLink(raw: string): InstalledAppLink | null {
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

  const uatIdx = parts.findIndex((p) => p.toLowerCase() === 'uat');
  if (uatIdx < 0) return null;
  const sessionPart = parts[uatIdx + 1];
  if (!sessionPart || sessionPart.toLowerCase() !== 'session') return null;
  if (parts[uatIdx + 2] !== undefined) return null;

  const token = url.searchParams.get('access_token')?.trim() ?? '';
  if (token.length < 8 || token.length > 8192) {
    return { kind: 'passthrough' };
  }
  const qs = new URLSearchParams({ access_token: token });
  return {
    kind: 'uat-session',
    href: `/uat/session?${qs.toString()}`,
  };
}

/**
 * Organization membership invite (Phase 3) — web `/invite` only, not native claim.
 * - `https://app.vemoki.com/invite#token=…`
 * - `vemoki://invite?token=…` or `/invite?token=`
 */
function parseMembershipInviteLink(raw: string): InstalledAppLink | null {
  let url: URL;
  try {
    if (/^https?:\/\//i.test(raw)) {
      url = new URL(raw);
      const path = url.pathname.replace(/\/+$/, '') || '/';
      if (path !== '/invite') return null;
      const token = extractMembershipInviteTokenFromUrl(url);
      return {
        kind: 'membership-invite',
        token,
        href: membershipInviteRouteHref(token),
      };
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      url = new URL(raw);
      if (!isAppScheme(url.protocol)) return null;
    } else {
      const pathOnly = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(`ticketsolution://host${pathOnly}`);
    }
  } catch {
    return null;
  }

  const parts = [
    url.hostname,
    ...url.pathname.split('/').filter((p) => p.length > 0),
  ].filter((p) => p && p !== 'host');

  const inviteHead = parts[0]?.toLowerCase();
  if (inviteHead !== 'invite') return null;
  if (parts.length > 1) return null;

  const token = extractMembershipInviteTokenFromUrl(url);
  return {
    kind: 'membership-invite',
    token,
    href: membershipInviteRouteHref(token),
  };
}

function membershipInviteRouteHref(token: string): string {
  if (token && isMembershipInviteToken(token)) {
    return `/membership-invite?token=${encodeURIComponent(token)}`;
  }
  return '/membership-invite';
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
