import {
  invitationDispatchPath,
  invitationsPath,
} from '../../../../../src/admin/invitation';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import { isUuid } from '../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

/** GET /api/bff/admin/invitations?tenantId&eventId&cursor&limit */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = scopeError({
    tenantId: url.searchParams.get('tenantId') ?? undefined,
    eventId: url.searchParams.get('eventId') ?? undefined,
  });
  if (!isScope(scope)) return scope;
  const cursor = url.searchParams.get('cursor')?.trim() || undefined;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (
    limit !== undefined &&
    (!Number.isInteger(limit) || limit < 1 || limit > 100)
  ) {
    return bffApiError('LIMIT_INVALID', 'limit must be 1..100.', 422);
  }
  return forwardWithBearer(invitationsPath(scope, { cursor, limit }), {
    method: 'GET',
  });
}

type DispatchBody = {
  tenantId?: string;
  eventId?: string;
  invitationIds?: unknown;
  previewRevision?: number;
  idempotencyKey?: string;
};

/**
 * POST dispatch (explicit selected ids + preview revision).
 * Prefer /dispatch-preview first — quota estimate does not reserve.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = scopeError(body);
  if (!isScope(scope)) return scope;
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
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
  if (
    !Number.isInteger(body.previewRevision) ||
    (body.previewRevision ?? 0) < 1
  ) {
    return bffApiError(
      'IMPORT_STALE_PREVIEW',
      'previewRevision from dispatch-preview is required.',
      422,
    );
  }
  return forwardWithBearer(invitationDispatchPath(scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      invitationIds: body.invitationIds.map((id) =>
        String(id).trim(),
      ),
      previewRevision: body.previewRevision,
    }),
  });
}
