import type { MeTicketsResponse, TicketSummary } from '@ticket/contracts';
import { getApiBaseUrl } from '../identity/config.ts';
import {
  type MeTicketsFetchScope,
  normalizeMeTicketsFetchScope,
} from './wallet-fetch-scope.ts';

function isTicketSummary(value: unknown): value is TicketSummary {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.ticketId === 'string' &&
    row.ticketId.length > 0 &&
    typeof row.tenantId === 'string' &&
    typeof row.eventId === 'string' &&
    typeof row.ticketTypeId === 'string' &&
    typeof row.sourceId === 'string' &&
    typeof row.state === 'string' &&
    typeof row.credentialVersion === 'number' &&
    typeof row.createdAt === 'string'
  );
}

function isMeTicketsResponse(value: unknown): value is MeTicketsResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (!Array.isArray(body.tickets)) return false;
  return body.tickets.every(isTicketSummary);
}

export type MeTicketsProbeResult =
  | { status: 'ok'; body: MeTicketsResponse }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

/** Ticket list probe must not hang forever when offline. */
export const ME_TICKETS_PROBE_TIMEOUT_MS = 8_000;

function withTimeoutSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * Discriminated GET /v1/me/tickets probe.
 * Callers must not fall back to offline cache on unauthorized.
 */
export async function probeMeTickets(
  bearer: string,
  scope: MeTicketsFetchScope | string,
  signal?: AbortSignal,
  timeoutMs: number = ME_TICKETS_PROBE_TIMEOUT_MS,
): Promise<MeTicketsProbeResult> {
  const base = getApiBaseUrl();
  const fetchScope = normalizeMeTicketsFetchScope(scope);
  if (!base || !bearer || !fetchScope) return { status: 'invalid' };
  const timed = withTimeoutSignal(signal, timeoutMs);
  try {
    const url = new URL(`${base}/v1/me/tickets`);
    if (fetchScope.kind === 'tenant') {
      url.searchParams.set('tenantId', fetchScope.tenantId);
    }
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      signal: timed.signal,
    });
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status >= 500) {
      return { status: 'unreachable' };
    }
    if (!response.ok) {
      return { status: 'invalid' };
    }
    const body: unknown = await response.json();
    return isMeTicketsResponse(body)
      ? { status: 'ok', body }
      : { status: 'invalid' };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  } finally {
    timed.cancel();
  }
}

/**
 * GET /v1/me/tickets?tenantId= with short-lived bearer.
 * Returns null on misconfig, network, or non-OK — never invents tickets.
 */
export async function fetchMeTickets(
  bearer: string,
  scope: MeTicketsFetchScope | string,
  signal?: AbortSignal,
): Promise<MeTicketsResponse | null> {
  const result = await probeMeTickets(bearer, scope, signal);
  return result.status === 'ok' ? result.body : null;
}
