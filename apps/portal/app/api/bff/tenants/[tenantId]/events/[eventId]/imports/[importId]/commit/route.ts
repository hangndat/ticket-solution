import { assertMutatingBrowser } from '../../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../../src/bff/upstream';

type Props = {
  params: Promise<{ tenantId: string; eventId: string; importId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const resolved = await params;
  const scope = await requireEventParams(
    Promise.resolve({
      tenantId: resolved.tenantId,
      eventId: resolved.eventId,
    }),
  );
  if (!isEventParams(scope)) return scope;
  const importId = resolved.importId?.trim() ?? '';
  if (!isUuid(importId)) {
    return bffApiError('IMPORT_NOT_FOUND', 'importId must be a UUID.', 422);
  }
  let body: {
    previewRevision?: number;
    mappingRevision?: number;
    fileHash?: string;
    idempotencyKey?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }
  const idempotencyKey = body.idempotencyKey?.trim() ?? '';
  if (!isUuid(idempotencyKey)) {
    return bffApiError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'idempotencyKey must be a UUID.',
      422,
    );
  }
  if (
    typeof body.previewRevision !== 'number' ||
    typeof body.mappingRevision !== 'number' ||
    typeof body.fileHash !== 'string' ||
    !body.fileHash.trim()
  ) {
    return bffApiError(
      'IMPORT_STALE_PREVIEW',
      'previewRevision, mappingRevision and fileHash are required.',
      422,
    );
  }
  return forwardStaffBearer(
    PORTAL_UPSTREAM.importCommit(scope.tenantId, scope.eventId, importId),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        previewRevision: body.previewRevision,
        mappingRevision: body.mappingRevision,
        fileHash: body.fileHash.trim(),
      }),
    },
  );
}
