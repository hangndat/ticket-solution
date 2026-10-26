import { assertMutatingBrowser } from '../../../../../../../src/bff/csrf';
import { isUuid } from '../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../src/bff/paths';
import { bffApiError, forwardStaffBearer } from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { tenantId: rawT, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.event(tenantId, eventId), {
    method: 'GET',
  });
}

export async function PATCH(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const { tenantId: rawT, eventId: rawE } = await params;
  const tenantId = rawT?.trim() ?? '';
  const eventId = rawE?.trim() ?? '';
  if (!isUuid(tenantId) || !isUuid(eventId)) {
    return bffApiError(
      'SCOPE_REQUIRED',
      'tenantId and eventId must be UUIDs.',
      422,
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  if (!body || typeof body !== 'object') {
    return bffApiError('INVALID_JSON', 'Request body must be an object.', 400);
  }
  const { idempotencyKey, ...payload } = body as Record<string, unknown>;
  if (typeof idempotencyKey !== 'string' || !isUuid(idempotencyKey.trim())) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  const expectedRevision = (body as { expectedRevision?: unknown })
    .expectedRevision;
  if (
    typeof expectedRevision !== 'number' ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 1
  ) {
    return bffApiError(
      'REVISION_REQUIRED',
      'expectedRevision must be a positive integer.',
      422,
    );
  }
  return forwardStaffBearer(PORTAL_UPSTREAM.event(tenantId, eventId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey.trim(),
    },
    body: JSON.stringify(payload),
  });
}
