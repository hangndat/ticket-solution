import {
  configRollbackUpstreamPath,
} from '../../../../../../src/admin/config-api';
import {
  parseRollbackBody,
  requireConfigScope,
  requireIdempotencyKey,
} from '../../../../../../src/admin/config-bff-body';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import { bffApiError, forwardWithBearer } from '../../../../../../src/bff/upstream';

/**
 * POST semantic rollback — new append-only version from target, then publish.
 * Body: ConfigRollbackBody + tenantId + eventId + idempotencyKey.
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const scope = requireConfigScope({
    tenantId: typeof body.tenantId === 'string' ? body.tenantId : undefined,
    eventId: typeof body.eventId === 'string' ? body.eventId : undefined,
  });
  if (scope instanceof Response) return scope;
  const idempotencyKey = requireIdempotencyKey(
    typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
  );
  if (idempotencyKey instanceof Response) return idempotencyKey;
  const rollback = parseRollbackBody(body);
  if (rollback instanceof Response) return rollback;
  return forwardWithBearer(configRollbackUpstreamPath(scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(rollback),
  });
}
