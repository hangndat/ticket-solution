import {
  ISSUE_ERROR_CODES,
  REDEMPTION_RESOLVE_HEADER,
  type FormAnswerValue,
  type RedeemRequestBody,
} from '@ticket/contracts';
import { assertMutatingBrowserAsync } from '../../../../src/bff/csrf';
import { bffApiError, forwardWithBearer, isUuid } from '../../../../src/bff/upstream';

type RedeemBffBody = {
  tenantId?: string;
  eventId?: string;
  idempotencyKey?: string;
  code?: string;
  formVersion?: string;
  termsVersion?: string;
  answers?: Record<string, FormAnswerValue>;
  termsAccepted?: boolean;
  resolveToken?: string;
};

const ALLOWED_KEYS = new Set([
  'tenantId',
  'eventId',
  'idempotencyKey',
  'code',
  'formVersion',
  'termsVersion',
  'answers',
  'termsAccepted',
  'resolveToken',
]);

function sanitizeAnswers(
  raw: unknown,
): Record<string, FormAnswerValue> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, FormAnswerValue> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) continue;
    if (typeof value === 'string' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Same-origin BFF: POST redeem → Nest
 * POST /v1/tenants/{tenantId}/events/{eventId}/redemptions
 * CSRF + Origin + allowlisted body fields.
 */
export async function POST(request: Request) {
  const csrf = await assertMutatingBrowserAsync(request);
  if (csrf) return csrf;

  let body: RedeemBffBody;
  try {
    body = (await request.json()) as RedeemBffBody;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return bffApiError('INVALID_JSON', 'Request body must be a JSON object.', 400);
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      return bffApiError(
        'INVALID_BODY',
        `Unexpected field: ${key}`,
        422,
      );
    }
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

  const answers = sanitizeAnswers(body.answers);
  const payload: RedeemRequestBody = {
    code,
    ...(body.formVersion?.trim()
      ? { formVersion: body.formVersion.trim() }
      : {}),
    ...(body.termsVersion?.trim()
      ? { termsVersion: body.termsVersion.trim() }
      : {}),
    ...(answers ? { answers } : {}),
    ...(body.termsAccepted === true ? { termsAccepted: true as const } : {}),
  };

  const resolveToken = body.resolveToken?.trim() ?? '';
  const upstreamHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'idempotency-key': idempotencyKey,
  };
  if (resolveToken) {
    upstreamHeaders[REDEMPTION_RESOLVE_HEADER] = resolveToken;
  }

  const path = `/v1/tenants/${encodeURIComponent(tenantId)}/events/${encodeURIComponent(eventId)}/redemptions`;
  return forwardWithBearer(path, {
    method: 'POST',
    headers: upstreamHeaders,
    body: JSON.stringify(payload),
  });
}
