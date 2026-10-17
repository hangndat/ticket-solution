import { IMPORT_COMMIT_COMMAND } from '@ticket/contracts';
import { importCommitPath } from '../../../../../../../src/admin/import-job';
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
  previewRevision?: number;
  mappingRevision?: number;
  fileHash?: string;
  idempotencyKey?: string;
};

/** POST commit — binds file hash + mapping/preview revisions; idempotent. */
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
  if (
    !Number.isInteger(body.previewRevision) ||
    (body.previewRevision ?? 0) < 1 ||
    !Number.isInteger(body.mappingRevision) ||
    (body.mappingRevision ?? 0) < 1
  ) {
    return bffApiError(
      'IMPORT_STALE_PREVIEW',
      'previewRevision and mappingRevision are required.',
      422,
    );
  }
  const fileHash = body.fileHash?.trim() ?? '';
  if (!fileHash) {
    return bffApiError(
      'IMPORT_FILE_INVALID',
      'fileHash from preview is required.',
      422,
    );
  }
  return forwardWithBearer(importCommitPath(scope, importId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      command: IMPORT_COMMIT_COMMAND,
      previewRevision: body.previewRevision,
      mappingRevision: body.mappingRevision,
      fileHash,
    }),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
