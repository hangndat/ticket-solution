import {
  IMPORT_CREATE_COMMAND,
  IMPORT_LIMITS,
  type ImportKind,
} from '@ticket/contracts';
import { importsCreatePath } from '../../../../../src/admin/import-job';
import { isScope, scopeError } from '../../../../../src/admin/scope';
import { isUuid } from '../../../../../src/bff/ids';
import { assertSameOrigin } from '../../../../../src/bff/origin';
import {
  bffApiError,
  forwardWithBearer,
} from '../../../../../src/bff/upstream';

const MAX_LEGACY_CODES = 500;

type Body = {
  tenantId?: string;
  eventId?: string;
  /** C-I job create */
  kind?: string;
  sourceId?: string;
  ticketTypeId?: string;
  fileId?: string;
  /** Legacy ≤500 codes — not a full CSV job. */
  codes?: unknown;
  rawCodes?: unknown;
  eventQuota?: number;
  idempotencyKey?: string;
  mappingRevision?: number;
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const codes = value.map((code) =>
    typeof code === 'string' ? code.trim() : '',
  );
  if (codes.some((code) => code.length === 0)) return null;
  return codes;
}

/**
 * POST /api/bff/admin/imports
 * - C-I job: kind + sourceId + ticketTypeId + fileId|rawCodes + Idempotency-Key
 * - Legacy: codes[] (≤500) for compatibility
 */
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

  const kind = (body.kind?.trim() || '') as ImportKind | '';
  const hasJobFields =
    kind === 'CODES' ||
    kind === 'GUESTS' ||
    Boolean(body.sourceId?.trim()) ||
    Boolean(body.ticketTypeId?.trim()) ||
    Boolean(body.fileId?.trim());

  if (hasJobFields) {
    if (kind !== 'CODES' && kind !== 'GUESTS') {
      return bffApiError(
        'IMPORT_KIND_REQUIRED',
        'kind must be CODES or GUESTS.',
        422,
      );
    }
    const sourceId = body.sourceId?.trim() ?? '';
    const ticketTypeId = body.ticketTypeId?.trim() ?? '';
    if (!isUuid(sourceId) || !isUuid(ticketTypeId)) {
      return bffApiError(
        'IMPORT_SOURCE_INVALID',
        'sourceId and ticketTypeId must be UUIDs.',
        422,
      );
    }
    const idempotencyKey = body.idempotencyKey?.trim() ?? '';
    if (!isUuid(idempotencyKey)) {
      return bffApiError(
        'IDEMPOTENCY_KEY_REQUIRED',
        'idempotencyKey must be a UUID.',
        422,
      );
    }
    const fileId = body.fileId?.trim() ?? '';
    const rawCodes =
      asStringArray(body.rawCodes) ?? asStringArray(body.codes);
    if (!fileId && !rawCodes) {
      return bffApiError(
        'IMPORT_FILE_INVALID',
        'fileId or rawCodes (legacy ≤500) is required.',
        422,
      );
    }
    if (rawCodes && rawCodes.length > MAX_LEGACY_CODES) {
      return bffApiError(
        'IMPORT_ROW_LIMIT',
        `rawCodes max ${MAX_LEGACY_CODES}; use CSV fileId job.`,
        422,
      );
    }
    if (
      body.mappingRevision !== undefined &&
      (!Number.isInteger(body.mappingRevision) || body.mappingRevision < 1)
    ) {
      return bffApiError(
        'IMPORT_STALE_PREVIEW',
        'mappingRevision must be a positive integer.',
        422,
      );
    }

    const payload: Record<string, unknown> = {
      kind,
      sourceId,
      ticketTypeId,
      command: IMPORT_CREATE_COMMAND,
    };
    if (fileId) payload.fileId = fileId;
    if (rawCodes) payload.rawCodes = rawCodes;
    if (body.mappingRevision !== undefined) {
      payload.mappingRevision = body.mappingRevision;
    }

    return forwardWithBearer(importsCreatePath(scope), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  }

  // Legacy compatibility path (array of codes, no CSV job).
  const codes = asStringArray(body.codes);
  if (!codes || codes.length > MAX_LEGACY_CODES) {
    return bffApiError(
      'CODES_REQUIRED',
      `codes must be 1 to ${MAX_LEGACY_CODES} strings.`,
      422,
    );
  }
  if (codes.length > IMPORT_LIMITS.maxRows) {
    return bffApiError(
      'IMPORT_ROW_LIMIT',
      `CSV/job row cap is ${IMPORT_LIMITS.maxRows}.`,
      422,
    );
  }
  const payload: { codes: string[]; eventQuota?: number } = { codes };
  if (Number.isInteger(body.eventQuota) && (body.eventQuota ?? 0) >= 1) {
    payload.eventQuota = body.eventQuota;
  }
  return forwardWithBearer(importsCreatePath(scope), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function GET() {
  return bffApiError('METHOD_NOT_ALLOWED', 'Use POST.', 405);
}
