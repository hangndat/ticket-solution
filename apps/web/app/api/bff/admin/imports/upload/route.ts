import { IMPORT_LIMITS } from '@ticket/contracts';
import {
  isAcceptedImportCsvFile,
  oversizedUploadContentLength,
} from '../../../../../../src/admin/import-upload-guard';
import { importsUploadPath } from '../../../../../../src/admin/import-job';
import { isScope, scopeError } from '../../../../../../src/admin/scope';
import { assertSameOrigin } from '../../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../../src/bff/upstream';

/**
 * POST multipart CSV → upstream quarantine upload (C-I fileId).
 * Fields: tenantId, eventId, kind, file (csv).
 */
export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  if (oversizedUploadContentLength(request.headers.get('content-length'))) {
    return bffApiError(
      'IMPORT_ROW_LIMIT',
      `CSV must be 1..${IMPORT_LIMITS.maxBytes} bytes.`,
      422,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bffApiError('INVALID_MULTIPART', 'Expected multipart form data.', 400);
  }

  const scope = scopeError({
    tenantId: String(form.get('tenantId') ?? ''),
    eventId: String(form.get('eventId') ?? ''),
  });
  if (!isScope(scope)) return scope;

  const kind = String(form.get('kind') ?? '').trim();
  if (kind !== 'CODES' && kind !== 'GUESTS') {
    return bffApiError(
      'IMPORT_KIND_REQUIRED',
      'kind must be CODES or GUESTS.',
      422,
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return bffApiError('IMPORT_FILE_INVALID', 'file is required.', 422);
  }
  if (file.size <= 0 || file.size > IMPORT_LIMITS.maxBytes) {
    return bffApiError(
      'IMPORT_ROW_LIMIT',
      `CSV must be 1..${IMPORT_LIMITS.maxBytes} bytes.`,
      422,
    );
  }
  if (!isAcceptedImportCsvFile(file)) {
    return bffApiError(
      'IMPORT_FILE_INVALID',
      'Only UTF-8 CSV files are accepted.',
      422,
    );
  }

  const upstream = new FormData();
  upstream.set('kind', kind);
  upstream.set('file', file, file.name || 'import.csv');

  return forwardWithBearer(importsUploadPath(scope), {
    method: 'POST',
    body: upstream,
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
