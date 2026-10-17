import { getTenantId } from '../identity/config.ts';
import type { SessionBoundary } from '../identity/session-boundary.ts';
import { fetchPublishedEventDetail } from '../published/published-event-api.ts';
import { probeMeTickets } from '../tickets/fetch-me-tickets.ts';
import type { NotificationKind } from './notification-contract.ts';

export type NotificationRouteTarget =
  | { kind: 'ticket'; href: string; ticketId: string }
  | {
      kind: 'event';
      href: string;
      tenantSlug: string;
      eventSlug: string;
    };

export type NotificationResolveResult =
  | { status: 'routed'; target: NotificationRouteTarget }
  | {
      status:
        | 'unsigned'
        | 'epoch-stale'
        | 'unauthorized'
        | 'not-found'
        | 'invalid'
        | 'unreachable'
        | 'misconfigured';
    };

export type NotificationResolveInput = {
  kind: NotificationKind;
  ticketId?: string;
  eventId?: string;
  tenantId?: string;
  tenantSlug?: string;
  eventSlug?: string;
};

export type NotificationResolveDeps = {
  session: SessionBoundary;
  /** Optional inject for unit tests — never a production fixture fallback. */
  probeTickets?: typeof probeMeTickets;
  fetchPublished?: typeof fetchPublishedEventDetail;
  resolveTenantId?: () => string | null;
  signal?: AbortSignal;
};

function publishedEventHref(tenantSlug: string, eventSlug: string): string {
  return `/events/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(eventSlug)}`;
}

function ticketHref(ticketId: string): string {
  return `/my-tickets/${ticketId}`;
}

/**
 * Re-authz push tap targets under a live verified epoch.
 * TicketIssued → owner ticket list membership.
 * Event/invitation kinds → published slug pair (never fixture by eventId).
 */
export async function resolveNotificationRoute(
  input: NotificationResolveInput,
  deps: NotificationResolveDeps,
): Promise<NotificationResolveResult> {
  const epoch = deps.session.captureEpoch();
  if (!epoch) return { status: 'unsigned' };

  const probeTickets = deps.probeTickets ?? probeMeTickets;
  const fetchPublished = deps.fetchPublished ?? fetchPublishedEventDetail;
  const resolveTenantId = deps.resolveTenantId ?? getTenantId;

  if (input.kind === 'TicketIssued') {
    const ticketId = input.ticketId?.trim() ?? '';
    if (!ticketId) return { status: 'invalid' };

    const tenantId = (input.tenantId?.trim() || resolveTenantId() || '').trim();
    if (!tenantId) return { status: 'misconfigured' };

    const bearer = await deps.session.getCredential();
    if (!deps.session.isEpochCurrent(epoch)) return { status: 'epoch-stale' };
    if (!bearer) return { status: 'unsigned' };

    const probe = await probeTickets(bearer, tenantId, deps.signal);
    if (!deps.session.isEpochCurrent(epoch)) return { status: 'epoch-stale' };

    if (probe.status === 'unauthorized') return { status: 'unauthorized' };
    if (probe.status === 'unreachable') return { status: 'unreachable' };
    if (probe.status !== 'ok') return { status: 'invalid' };

    const owned = probe.body.tickets.some((t) => t.ticketId === ticketId);
    if (!owned) return { status: 'not-found' };

    if (input.eventId) {
      const match = probe.body.tickets.find((t) => t.ticketId === ticketId);
      if (match && match.eventId !== input.eventId) {
        return { status: 'not-found' };
      }
    }

    return {
      status: 'routed',
      target: { kind: 'ticket', href: ticketHref(ticketId), ticketId },
    };
  }

  const tenantSlug = input.tenantSlug?.trim() ?? '';
  const eventSlug = input.eventSlug?.trim() ?? '';
  if (!tenantSlug || !eventSlug) return { status: 'invalid' };

  // Still require verified epoch before navigating event change taps so a
  // previous-account pending intent cannot surface after switch.
  if (!deps.session.isEpochCurrent(epoch)) return { status: 'epoch-stale' };

  const published = await fetchPublished(tenantSlug, eventSlug, deps.signal);
  if (!deps.session.isEpochCurrent(epoch)) return { status: 'epoch-stale' };

  if (published.status === 'not-found') return { status: 'not-found' };
  if (published.status === 'unreachable') return { status: 'unreachable' };
  if (published.status === 'misconfigured') return { status: 'misconfigured' };
  if (published.status !== 'ok') return { status: 'invalid' };

  if (input.eventId && published.event.id !== input.eventId) {
    return { status: 'not-found' };
  }

  return {
    status: 'routed',
    target: {
      kind: 'event',
      href: publishedEventHref(tenantSlug, eventSlug),
      tenantSlug,
      eventSlug,
    },
  };
}
