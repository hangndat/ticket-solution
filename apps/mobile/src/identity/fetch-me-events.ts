import type { MeEventItem, MeEventsResponse } from '@ticket/contracts';
import { getApiBaseUrl } from './config.ts';

function isMeEventItem(value: unknown): value is MeEventItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.tenantId === 'string' &&
    row.tenantId.length > 0 &&
    typeof row.eventId === 'string' &&
    row.eventId.length > 0 &&
    typeof row.name === 'string' &&
    Array.isArray(row.permissions) &&
    row.permissions.every((p) => typeof p === 'string')
  );
}

function isMeEventsResponse(value: unknown): value is MeEventsResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  if (typeof body.staffEligible !== 'boolean') return false;
  if (!Array.isArray(body.items)) return false;
  return body.items.every(isMeEventItem);
}

export type MeEventsProbeResult =
  | { status: 'ok'; body: MeEventsResponse }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

/** MeEvents discovery must not hang forever when offline. */
export const ME_EVENTS_PROBE_TIMEOUT_MS = 8_000;

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
 * Discriminated GET /v1/me/events probe (O02 staffEligible).
 * Callers must treat non-ok as not eligible — never invent staff chrome.
 */
export async function probeMeEvents(
  bearer: string,
  signal?: AbortSignal,
  timeoutMs: number = ME_EVENTS_PROBE_TIMEOUT_MS,
): Promise<MeEventsProbeResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return { status: 'invalid' };
  const timed = withTimeoutSignal(signal, timeoutMs);
  try {
    const response = await fetch(`${base}/v1/me/events`, {
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
    return isMeEventsResponse(body)
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
 * GET /v1/me/events with short-lived bearer.
 * Returns null on misconfig, network, or non-OK — never invents eligibility.
 */
export async function fetchMeEvents(
  bearer: string,
  signal?: AbortSignal,
): Promise<MeEventsResponse | null> {
  const result = await probeMeEvents(bearer, signal);
  return result.status === 'ok' ? result.body : null;
}
