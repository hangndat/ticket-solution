import { assertSameOrigin } from '../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../src/bff/upstream';
import { eventPath, isScope, scopeError } from '../../../../../src/admin/scope';

type Body = {
  tenantId?: string;
  eventId?: string;
  payload?: unknown;
  schemaVersion?: number;
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
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) {
    return bffApiError('CONFIG_PAYLOAD_REQUIRED', 'payload object is required.', 422);
  }
  const payload: { payload: object; schemaVersion?: number } = { payload: body.payload };
  if (Number.isInteger(body.schemaVersion) && (body.schemaVersion ?? 0) >= 1) {
    payload.schemaVersion = body.schemaVersion;
  }
  return forwardWithBearer(eventPath(scope, 'config-versions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
