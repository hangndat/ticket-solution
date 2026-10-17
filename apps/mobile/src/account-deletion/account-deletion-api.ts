import { getApiBaseUrl } from '../identity/config.ts';
import type { AccountDeletionRequest } from './types.ts';

const STATES = new Set([
  'REQUESTED',
  'UNDER_REVIEW',
  'AWAITING_POLICY',
  'COMPLETED',
  'REJECTED',
]);

export function isAccountDeletionRequest(
  value: unknown,
): value is AccountDeletionRequest {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.requestId === 'string' &&
    body.requestId.length > 0 &&
    typeof body.state === 'string' &&
    STATES.has(body.state) &&
    typeof body.requestedAt === 'string' &&
    body.requestedAt.length > 0 &&
    (body.policyStatus === 'UNRESOLVED' || body.policyStatus === 'CONFIGURED')
  );
}

export type PostAccountDeletionResult =
  | { status: 'ok'; request: AccountDeletionRequest; httpStatus: number }
  | { status: 'unauthorized' }
  | { status: 'confirmation-required' }
  | { status: 'idempotency-key-required' }
  | { status: 'idempotency-conflict' }
  | { status: 'unreachable' }
  | { status: 'invalid'; httpStatus?: number; code?: string };

export type GetCurrentAccountDeletionResult =
  | { status: 'ok'; request: AccountDeletionRequest | null }
  | { status: 'unauthorized' }
  | { status: 'unreachable' }
  | { status: 'invalid'; httpStatus?: number };

/**
 * POST /v1/me/account-deletion-requests
 * Expects 202 (+ replay may return same body). Never invents COMPLETED.
 */
export async function postAccountDeletionRequest(
  bearer: string,
  idempotencyKey: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<PostAccountDeletionResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return { status: 'invalid' };
  if (!idempotencyKey) return { status: 'idempotency-key-required' };
  try {
    const response = await fetchImpl(`${base}/v1/me/account-deletion-requests`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ confirmation: true }),
      signal,
    });
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status === 422) {
      const code = await readErrorCode(response);
      if (code === 'CONFIRMATION_REQUIRED') {
        return { status: 'confirmation-required' };
      }
      if (code === 'IDEMPOTENCY_KEY_REQUIRED') {
        return { status: 'idempotency-key-required' };
      }
      return { status: 'invalid', httpStatus: 422, code: code ?? undefined };
    }
    if (response.status === 409) {
      return { status: 'idempotency-conflict' };
    }
    if (response.status >= 500) {
      return { status: 'unreachable' };
    }
    if (response.status < 200 || response.status >= 300) {
      return { status: 'invalid', httpStatus: response.status };
    }
    const json: unknown = await response.json();
    if (!isAccountDeletionRequest(json)) {
      return { status: 'invalid', httpStatus: response.status };
    }
    // ACK must not be treated as COMPLETED erasure (O06 unsettled).
    if (json.state === 'COMPLETED') {
      return { status: 'invalid', httpStatus: response.status };
    }
    return { status: 'ok', request: json, httpStatus: response.status };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

/**
 * GET /v1/me/account-deletion-requests/current
 * 200 with raw object or null (no wrapper).
 */
export async function getCurrentAccountDeletionRequest(
  bearer: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<GetCurrentAccountDeletionResult> {
  const base = getApiBaseUrl();
  if (!base || !bearer) return { status: 'invalid' };
  try {
    const response = await fetchImpl(
      `${base}/v1/me/account-deletion-requests/current`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        signal,
      },
    );
    if (response.status === 401 || response.status === 403) {
      return { status: 'unauthorized' };
    }
    if (response.status >= 500) {
      return { status: 'unreachable' };
    }
    if (!response.ok) {
      return { status: 'invalid', httpStatus: response.status };
    }
    const text = await response.text();
    if (!text || text.trim() === 'null') {
      return { status: 'ok', request: null };
    }
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      return { status: 'invalid', httpStatus: response.status };
    }
    if (json === null) return { status: 'ok', request: null };
    if (!isAccountDeletionRequest(json)) {
      return { status: 'invalid', httpStatus: response.status };
    }
    return { status: 'ok', request: json };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { status: 'unreachable' };
    }
    return { status: 'unreachable' };
  }
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const json: unknown = await response.json();
    if (
      json &&
      typeof json === 'object' &&
      typeof (json as { code?: unknown }).code === 'string'
    ) {
      return (json as { code: string }).code;
    }
  } catch {
    /* ignore */
  }
  return null;
}
