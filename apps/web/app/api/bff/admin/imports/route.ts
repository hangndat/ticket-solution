import { assertSameOrigin } from '../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../src/bff/upstream';
import { eventPath, isScope, scopeError } from '../../../../../src/admin/scope';

const MAX_CODES = 500;

type Body = {
  tenantId?: string;
  eventId?: string;
  codes?: unknown;
  eventQuota?: number;
};

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError(body);
  if (!isScope(scope)) return scope;
  if (!Array.isArray(body.codes) || body.codes.length === 0 || body.codes.length > MAX_CODES) {
    return bffApiError('CODES_REQUIRED', 'codes must be 1 to 500 strings.', 422);
  }
  const codes = body.codes.map((code) => (typeof code === 'string' ? code.trim() : ''));
  if (codes.some((code) => code.length === 0)) {
    return bffApiError('CODES_REQUIRED', 'each code must be a non-empty string.', 422);
  }
  const payload: { codes: string[]; eventQuota?: number } = { codes };
  if (Number.isInteger(body.eventQuota) && (body.eventQuota ?? 0) >= 1) {
    payload.eventQuota = body.eventQuota;
  }
  return forwardWithBearer(eventPath(scope, 'imports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
