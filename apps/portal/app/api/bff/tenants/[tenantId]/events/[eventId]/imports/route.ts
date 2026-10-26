import { IMPORT_LIMITS, type ImportKind } from '@ticket/contracts';
import { assertMutatingBrowser } from '../../../../../../../../src/bff/csrf';
import {
  isEventParams,
  pickSearchParams,
  requireEventParams,
} from '../../../../../../../../src/bff/event-params';
import { isUuid } from '../../../../../../../../src/bff/ids';
import { PORTAL_UPSTREAM } from '../../../../../../../../src/bff/paths';
import {
  bffApiError,
  forwardStaffBearer,
} from '../../../../../../../../src/bff/upstream';

type Props = { params: Promise<{ tenantId: string; eventId: string }> };

/** List existing jobs so an operator can resume after a reload. */
export async function GET(request: Request, { params }: Props) {
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;
  const qs = pickSearchParams(new URL(request.url), [
    'cursor',
    'limit',
    'status',
    'kind',
  ]);
  return forwardStaffBearer(
    `${PORTAL_UPSTREAM.imports(scope.tenantId, scope.eventId)}${qs}`,
    { method: 'GET' },
  );
}

type Body = {
  kind?: string;
  sourceId?: string;
  ticketTypeId?: string;
  fileId?: string;
  codes?: unknown;
  rawCodes?: unknown;
  eventQuota?: number;
  idempotencyKey?: string;
  mappingRevision?: number;
  columnMapping?: { code?: string; email?: string };
};

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const codes = value.map((code) =>
    typeof code === 'string' ? code.trim() : '',
  );
  if (codes.some((code) => code.length === 0)) return null;
  return codes;
}

/** POST create import job (or legacy codes[]). */
export async function POST(request: Request, { params }: Props) {
  const csrf = await assertMutatingBrowser(request);
  if (csrf) return csrf;
  const scope = await requireEventParams(params);
  if (!isEventParams(scope)) return scope;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bffApiError('INVALID_JSON', 'Request body must be JSON.', 400);
  }

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
    const fileId = body.fileId?.trim();
    const rawCodes =
      asStringArray(body.rawCodes) ?? asStringArray(body.codes);
    if (!fileId && !rawCodes) {
      return bffApiError(
        'IMPORT_FILE_INVALID',
        'Provide fileId or rawCodes (≤500).',
        422,
      );
    }
    if (rawCodes && rawCodes.length > 500) {
      return bffApiError(
        'IMPORT_ROW_LIMIT',
        `rawCodes max 500; maxRows ${IMPORT_LIMITS.maxRows} for CSV jobs.`,
        422,
      );
    }
    const payload: Record<string, unknown> = {
      kind,
      sourceId,
      ticketTypeId,
    };
    if (fileId) payload.fileId = fileId;
    if (rawCodes) payload.rawCodes = rawCodes;
    if (
      typeof body.mappingRevision === 'number' &&
      Number.isInteger(body.mappingRevision)
    ) {
      payload.mappingRevision = body.mappingRevision;
    }
    if (body.columnMapping && typeof body.columnMapping === 'object') {
      payload.columnMapping = body.columnMapping;
    }
    return forwardStaffBearer(
      PORTAL_UPSTREAM.imports(scope.tenantId, scope.eventId),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      },
    );
  }

  const codes = asStringArray(body.codes);
  if (!codes) {
    return bffApiError(
      'CODES_REQUIRED',
      'codes must be a non-empty string array (legacy) or provide job fields.',
      422,
    );
  }
  if (codes.length > 500) {
    return bffApiError('IMPORT_ROW_LIMIT', 'Legacy codes max 500.', 422);
  }
  const legacy: Record<string, unknown> = { codes };
  if (typeof body.eventQuota === 'number') legacy.eventQuota = body.eventQuota;
  return forwardStaffBearer(
    PORTAL_UPSTREAM.imports(scope.tenantId, scope.eventId),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacy),
    },
  );
}
