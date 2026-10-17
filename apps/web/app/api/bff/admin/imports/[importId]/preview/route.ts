import { IMPORT_PREVIEW_COMMAND } from '@ticket/contracts';
import { importPreviewPath } from '../../../../../../../src/admin/import-job';
import { isScope, scopeError } from '../../../../../../../src/admin/scope';
import { isUuid } from '../../../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ importId: string }> };

type Body = {
  tenantId?: string;
  eventId?: string;
  mappingRevision?: number;
  idempotencyKey?: string;
};

/** POST preview — no business writes; returns row errors + quota estimate. */
export async function POST(request: Request, { params }: Props) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const { importId: rawId } = await params;
  const importId = rawId?.trim() ?? '';
  if (!isUuid(importId)) {
    return bffApiError('IMPORT_ID_REQUIRED', 'importId must be a UUID.', 422);
  }
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
  const payload: Record<string, unknown> = {
    command: IMPORT_PREVIEW_COMMAND,
  };
  if (
    body.mappingRevision !== undefined &&
    Number.isInteger(body.mappingRevision) &&
    (body.mappingRevision ?? 0) >= 1
  ) {
    payload.mappingRevision = body.mappingRevision;
  }
  return forwardWithBearer(importPreviewPath(scope, importId), {
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
