import { assertSameOrigin } from '../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../src/bff/upstream';
import { eventPath, isScope, scopeError } from '../../../../../src/admin/scope';

type Body = { tenantId?: string; eventId?: string; expectedVersion?: number };

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
  if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion ?? 0) < 1) {
    return bffApiError('CONFIG_VERSION_REQUIRED', 'expectedVersion must be a positive integer.', 422);
  }
  return forwardWithBearer(eventPath(scope, 'publish'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedVersion: body.expectedVersion }),
  });
}
