import {
  ISSUE_ERROR_CODES,
  type RedeemRequestBody,
} from '@ticket/contracts';
import { bffApiError, forwardWithBearer, isUuid } from '../../../../src/bff/upstream';

type RedeemBffBody = RedeemRequestBody & {
  tenantId?: string;
  eventId?: string;
  idempotencyKey?: string;
};

/**
 * Same-origin BFF: POST redeem → Nest
 * POST /v1/tenants/{tenantId}/events/{eventId}/redemptions
 * with Authorization Bearer from HttpOnly cookie + idempotency-key.
 */
export async function POST(request: Request) {
  let body: RedeemBffBody;
  try {
    body = (await request.json()) as RedeemBffBody;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

  const tenantId = body.tenantId?.trim() ?? '';
  const eventId = body.eventId?.trim() ?? '';
  const code = body.code?.trim() ?? '';
  const idempotencyKey =
    body.idempotencyKey?.trim() || crypto.randomUUID();

  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  if (!code) {
    return bffApiError(
      ISSUE_ERROR_CODES.CODE_INVALID,
      'Redemption code is required.',
      422,
    );
  }
  if (!idempotencyKey) {
    return bffApiError(
      ISSUE_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'idempotencyKey is required.',
      422,
    );
  }

  const payload: RedeemRequestBody = {
    code,
    ...(body.formVersion?.trim()
      ? { formVersion: body.formVersion.trim() }
      : {}),
    ...(body.termsVersion?.trim()
      ? { termsVersion: body.termsVersion.trim() }
      : {}),
  };

  const path = `/v1/tenants/${encodeURIComponent(tenantId)}/events/${encodeURIComponent(eventId)}/redemptions`;
  return forwardWithBearer(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}
