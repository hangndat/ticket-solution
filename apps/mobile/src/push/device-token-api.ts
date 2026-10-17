import { getApiBaseUrl } from '../identity/config.ts';
import type {
  DeviceTokenRegisterBody,
  DeviceTokenRegistration,
} from './device-token-types.ts';

function isRegistration(value: unknown): value is DeviceTokenRegistration {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.registrationId === 'string' &&
    body.registrationId.length > 0 &&
    (body.environment === 'sandbox' || body.environment === 'production') &&
    typeof body.registeredAt === 'string' &&
    body.registeredAt.length > 0
  );
}

export type RegisterDeviceTokenResult =
  | { status: 'ok'; registration: DeviceTokenRegistration }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid'; httpStatus?: number };

export type DeleteDeviceTokenResult =
  | { status: 'ok' }
  | { status: 'not-found' }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid'; httpStatus?: number };

/**
 * POST /v1/me/device-tokens — Bearer OIDC access token.
 * Accepts any 2xx (Nest may return 200 or 201) and validates the body.
 */
export async function postDeviceToken(
  bearer: string,
  body: DeviceTokenRegisterBody,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<RegisterDeviceTokenResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return { status: 'invalid' };
  try {
    const response = await fetchImpl(`${base}/v1/me/device-tokens`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status >= 500) {
      return { status: 'unreachable' };
    }
    if (response.status < 200 || response.status >= 300) {
      return { status: 'invalid', httpStatus: response.status };
    }
    const json: unknown = await response.json();
    return isRegistration(json)
      ? { status: 'ok', registration: json }
      : { status: 'invalid', httpStatus: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

/**
 * DELETE /v1/me/device-tokens/{registrationId} — Bearer; expects 204.
 * 404 REGISTRATION_NOT_FOUND is treated as already detached (ok).
 */
export async function deleteDeviceToken(
  bearer: string,
  registrationId: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<DeleteDeviceTokenResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer || !registrationId) return { status: 'invalid' };
  try {
    const response = await fetchImpl(
      `${base}/v1/me/device-tokens/${encodeURIComponent(registrationId)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        signal,
      },
    );
    if (response.status === 204 || response.status === 200) {
      return { status: 'ok' };
    }
    if (response.status === 404) {
      return { status: 'not-found' };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status >= 500) {
      return { status: 'unreachable' };
    }
    return { status: 'invalid', httpStatus: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}
