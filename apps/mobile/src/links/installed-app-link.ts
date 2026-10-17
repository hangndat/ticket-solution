import { isAppScheme } from '../identity/app-schemes.ts';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9-]{0,80}$/;

export type InstalledAppLink =
  | { kind: 'ticket'; ticketId: string; href: string }
  | { kind: 'event'; eventId: string; href: string }
  | { kind: 'oauth-callback' }
  | { kind: 'passthrough' };

/**
 * Classify an installed-app URL before Expo Router sees it.
 * `vemoki://oauth/callback` and `ticketsolution://oauth/callback` stay auth
 * redirects (router must not navigate). Ticket and event links rewrite onto
 * existing screens. Fixture event ids (e.g. `demo-fun-fest`) are preserved.
 */
export function parseInstalledAppLink(input: string): InstalledAppLink {
  const raw = input.trim();
  if (!raw) return { kind: 'passthrough' };
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
  if (parsed.kind === 'ticket' || parsed.kind === 'event') return parsed.href;
  return input;
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
