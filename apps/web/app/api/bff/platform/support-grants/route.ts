import { assertMutatingBrowserAsync } from '../../../../../src/bff/csrf';
import { bffApiError, isUuid } from '../../../../../src/bff/upstream';
import { PLATFORM_PATHS } from '../../../../../src/platform/contracts';
import { forwardPlatformBearer } from '../../../../../src/platform/forward';

type Body = {
  tenantId?: string;
  eventId?: string;
  scopes?: string[];
  reason?: string;
  expiresAt?: string;
  idempotencyKey?: string;
};

/** POST /api/bff/platform/support-grants — read-only cs.read grant. */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  const reason = body.reason?.trim() ?? '';
  const expiresAt = body.expiresAt?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId) || !reason || !expiresAt) {
    return bffApiError(
      'INVALID_INPUT',
      'tenantId, eventId, reason, expiresAt required.',
      422,
    );
  }
  if (reason.length > 500) {
    return bffApiError('INVALID_INPUT', 'reason max 500 characters.', 422);
  }
  const scopes = body.scopes ?? ['cs.read'];
  if (!scopes.length || !scopes.every((s) => s === 'cs.read')) {
    return bffApiError(
      'INVALID_INPUT',
      'Only scopes=["cs.read"] allowed in MVP.',
      422,
    );
  }
  return forwardPlatformBearer(PLATFORM_PATHS.supportGrants, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      tenantId,
      eventId,
      scopes: ['cs.read'],
      reason,
      expiresAt,
    }),
  });
}
