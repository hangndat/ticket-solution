import type { MeTicketsResponse, TicketSummary } from '@ticket/contracts';
import { getApiBaseUrl } from '../identity/config.ts';

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

/**
 * GET /v1/me/tickets?tenantId= with short-lived bearer.
 * Returns null on misconfig, network, or non-OK — never invents tickets.
 */
export async function fetchMeTickets(
  bearer: string,
  tenantId: string,
  signal?: AbortSignal,
): Promise<MeTicketsResponse | null> {
  const base = getApiBaseUrl();
  if (!base || !bearer || !tenantId) return null;
  try {
    const url = new URL(`${base}/v1/me/tickets`);
    url.searchParams.set('tenantId', tenantId);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      signal,
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isMeTicketsResponse(body) ? body : null;
  } catch {
    return null;
  }
}
