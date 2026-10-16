import type { MeResponse } from '@ticket/contracts';
import {
  CREDENTIAL_UNREACHABLE,
  type VerifyCredential,
} from './session-boundary.ts';
import { getApiBaseUrl } from './config.ts';

function isMeResponse(value: unknown): value is MeResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return typeof body.userId === 'string' && body.userId.length > 0;
}

export type MeProbeResult =
  | { status: 'ok'; me: MeResponse }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid' };

/** Startup / restore probe must not hang forever when offline. */
export const ME_PROBE_TIMEOUT_MS = 8_000;

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
 * Discriminated GET /v1/me probe.
 * - unauthorized: explicit 401/403 (token invalid/revoked)
 * - unreachable: network failure, timeout, or 5xx (do not treat as revoked)
 * - invalid: other non-OK / malformed body
 */
export async function probeMe(
  bearer: string,
  signal?: AbortSignal,
  timeoutMs: number = ME_PROBE_TIMEOUT_MS,
): Promise<MeProbeResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return { status: 'invalid' };
  const timed = withTimeoutSignal(signal, timeoutMs);
  try {
    const response = await fetch(`${base}/v1/me`, {
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
    return isMeResponse(body)
      ? { status: 'ok', me: body }
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
 * GET /v1/me with a short-lived bearer. Returns null on misconfig, network, or
 * non-OK — never invents a verified identity.
 */
export async function fetchMe(
  bearer: string,
  signal?: AbortSignal,
): Promise<MeResponse | null> {
  const result = await probeMe(bearer, signal);
  return result.status === 'ok' ? result.me : null;
}

/**
 * Server-validated subject for SessionBoundary — never trust local JWT claims alone.
 * Unreachable network returns CREDENTIAL_UNREACHABLE so restore can keep the
 * keychain credential without elevating to verified.
 */
export const verifyViaMe: VerifyCredential = async (credential) => {
  const result = await probeMe(credential);
  if (result.status === 'ok') return { userId: result.me.userId };
  if (result.status === 'unreachable') return CREDENTIAL_UNREACHABLE;
  return null;
};
