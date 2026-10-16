import type { MeResponse } from '@ticket/contracts';
import type { VerifyCredential } from './session-boundary.ts';
import { getApiBaseUrl } from './config.ts';

function isMeResponse(value: unknown): value is MeResponse {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return typeof body.userId === 'string' && body.userId.length > 0;
}

/**
 * GET /v1/me with a short-lived bearer. Returns null on misconfig, network, or
 * non-OK — never invents a verified identity.
 */
export async function fetchMe(
  bearer: string,
  signal?: AbortSignal,
): Promise<MeResponse | null> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return null;
  try {
    const response = await fetch(`${base}/v1/me`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      signal,
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isMeResponse(body) ? body : null;
  } catch {
    return null;
  }
}

/** Server-validated subject for SessionBoundary — never trust local JWT claims alone. */
export const verifyViaMe: VerifyCredential = async (credential) => {
  const me = await fetchMe(credential);
  return me ? { userId: me.userId } : null;
};
