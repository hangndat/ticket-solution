import { IMPORT_LIMITS } from '@ticket/contracts';
import { assertMutatingMultipart } from '../../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  requireEventParams,
} from '../../../../../../../../../src/bff/event-params';
import { PORTAL_UPSTREAM } from '../../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** POST multipart CSV → Nest quarantine upload. */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingMultipart(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bffApiError(
      'INVALID_MULTIPART',
      'Expected multipart form data.',
      400,
    );
  }

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
  const name = file.name.toLowerCase();
  if (
    !name.endsWith('.csv') &&
    file.type &&
    !file.type.includes('csv') &&
    !file.type.includes('text')
  ) {
    return bffApiError(
      'IMPORT_FILE_INVALID',
      'Only UTF-8 CSV files are accepted.',
      422,
    );
  }

  const upstream = new FormData();
  upstream.set('kind', kind);
  upstream.set('file', file, file.name || 'import.csv');

  return forwardStaffBearer(
    PORTAL_UPSTREAM.importsUpload(scope.tenantId, scope.eventId),
    { method: 'POST', body: upstream },
  );
}
