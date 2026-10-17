import { exportsCreatePath } from '../../../../../src/admin/export-job';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import { isUuid } from '../../../../../src/bff/ids';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

type Body = {
  tenantId?: string;
  eventId?: string;
  format?: string;
  filter?: unknown;
  idempotencyKey?: string;
};

/** POST /api/bff/admin/exports → create CSV export job with Idempotency-Key. */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
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
  const format = (body.format?.trim() || 'csv').toLowerCase();
  if (format !== 'csv') {
    return bffApiError('FORMAT_UNSUPPORTED', 'Only format=csv is accepted.', 422);
  }
  const payload: Record<string, unknown> = { format };
  if (body.filter !== undefined) payload.filter = body.filter;
  return forwardWithBearer(exportsCreatePath(scope), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
