import { invitationDispatchPreviewPath } from '../../../../../../src/admin/invitation';
import { isScope, scopeError } from '../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  invitationIds?: unknown;
  idempotencyKey?: string;
};

/** POST dispatch-preview — quota estimate only, no reserve / no mail. */
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
  if (
    !Array.isArray(body.invitationIds) ||
    body.invitationIds.length === 0 ||
    !body.invitationIds.every(
      (id) => typeof id === 'string' && isUuid(id.trim()),
    )
  ) {
    return bffApiError(
      'INVITATION_IDS_REQUIRED',
      'invitationIds must be a non-empty UUID array.',
      422,
    );
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (idempotencyKey) {
    if (!isUuid(idempotencyKey)) {
      return bffApiError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'idempotencyKey must be a UUID when provided.',
        422,
      );
    }
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return forwardWithBearer(invitationDispatchPreviewPath(scope), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      invitationIds: body.invitationIds.map((id) => String(id).trim()),
    }),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
