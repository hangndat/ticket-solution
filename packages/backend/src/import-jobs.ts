/**
 * H-I1 multi-step CSV import jobs — quarantine upload → preview → commit.
 * Preview never reserves quota. CODES commit inserts AVAILABLE codes only.
 */
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  CURSOR_PAGE_LIMIT,
  IMPORT_ERROR_REPORT_TTL_HOURS_DEV,
  IMPORT_LIMITS,
  type FieldValidationError,
  type ImportColumnMapping,
  type ImportCommitBody,
  type ImportCommitResponse,
  type ImportCreateBody,
  type ImportFileUploadResponse,
  type ImportJob,
  type ImportJobListPage,
  type ImportJobListQuery,
  type ImportJobSummary,
  type ImportJobStatus,
  type ImportKind,
  type ImportPreviewBody,
  type ImportPreviewResponse,
} from '@ticket/contracts';
import type { Prisma, PrismaClient } from './generated/prisma/client';
import { AuthzError, AUTHZ_ERROR_CODES } from './authz-error';
import { hashRedemptionCode, type CodeHmacConfig } from './code-hmac';
import { toCsvRow } from './csv-guard';
import { IMPORT_ERROR_CODES, ImportError } from './import-error';
import { requireTenantPermission } from './membership';
import type { ObjectStore } from './minio';
import { withTenant } from './tenant-context';

const PERMISSION_IMPORT = 'inventory.import';
const COMMIT_COMMAND = 'import.commit';
const SAMPLE_ERROR_LIMIT = 20;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type JobCursor = [
  number,
  string,
  string,
  ImportJobStatus | null,
  ImportKind | null,
  string,
  string,
];

function invalidCursor(): never {
  throw new ImportError(
    IMPORT_ERROR_CODES.INVALID_CURSOR,
    'Invalid import cursor',
  );
}

function cursorSignature(payload: string, secret: string): Buffer {
  return createHmac('sha256', secret)
    .update('import-jobs:v1:')
    .update(payload)
    .digest();
}

function encodeJobCursor(value: JobCursor, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${payload}.${cursorSignature(payload, secret).toString('base64url')}`;
}

function decodeJobCursor(
  raw: string,
  secret: string,
  tenantId: string,
  eventId: string,
  status: ImportJobStatus | null,
  kind: ImportKind | null,
): { createdAt: string; id: string } {
  if (raw.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw))
    invalidCursor();
  const [payload, mac] = raw.split('.');
  const given = Buffer.from(mac!, 'base64url');
  const expected = cursorSignature(payload!, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    invalidCursor();
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8'));
  } catch {
    invalidCursor();
  }
  if (
    !Array.isArray(value) ||
    value.length !== 7 ||
    value[0] !== 1 ||
    value[1] !== tenantId ||
    value[2] !== eventId ||
    value[3] !== status ||
    value[4] !== kind ||
    typeof value[5] !== 'string' ||
    !Number.isFinite(Date.parse(value[5])) ||
    typeof value[6] !== 'string' ||
    !UUID_RE.test(value[6])
  )
    invalidCursor();
  return { createdAt: value[5], id: value[6] };
}

type JobRow = {
  id: string;
  event_id: string;
  kind: ImportKind;
  status: ImportJobStatus;
  source_id: string;
  ticket_type_id: string;
  file_id: string | null;
  file_hash: string | null;
  raw_codes_json: unknown;
  mapping_revision: number | null;
  column_mapping: ImportColumnMapping;
  preview_revision: number | null;
  valid_row_count: number | null;
  error_row_count: number | null;
  invitation_count: number | null;
  estimated_quota: number | null;
  sample_errors: FieldValidationError[];
  error_report_csv: string | null;
  error_report_expires_at: Date | null;
  commit_response: ImportCommitResponse | null;
};

function quarantineKey(
  tenantId: string,
  eventId: string,
  fileId: string,
): string {
  return `tenants/${tenantId}/events/${eventId}/imports/quarantine/${fileId}`;
}

function requireUuid(value: string | undefined, label: string): string {
  const trimmed = value?.trim() ?? '';
  if (!UUID_RE.test(trimmed)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      `${label} must be a UUID`,
      422,
    );
  }
  return trimmed;
}

function requireIdempotencyKey(raw: string | undefined): string {
  const key = raw?.trim() ?? '';
  if (!UUID_RE.test(key)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
      'Idempotency-Key must be a UUID',
      400,
    );
  }
  return key;
}

function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

function assertUtf8Csv(buf: Buffer): string {
  if (buf.length === 0 || buf.length > IMPORT_LIMITS.maxBytes) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      `CSV must be 1..${IMPORT_LIMITS.maxBytes} bytes`,
    );
  }
  // Reject UTF-16 BOM
  if (
    (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) ||
    (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)
  ) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'UTF-16 is not accepted; use UTF-8 CSV',
    );
  }
  let text: string;
  try {
    text = buf.toString('utf8');
  } catch {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV must be valid UTF-8',
    );
  }
  if (text.includes('\uFFFD')) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV contains invalid UTF-8 sequences',
    );
  }
  return text.replace(/^\uFEFF/, '');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim().length > 0)) rows.push(row);
  return rows;
}

function defaultMapping(kind: ImportKind): ImportColumnMapping {
  return kind === 'CODES' ? { code: 'code' } : { email: 'email' };
}

function normalizeMapping(
  kind: ImportKind,
  mapping: ImportColumnMapping | undefined,
): ImportColumnMapping {
  const base = defaultMapping(kind);
  const next: ImportColumnMapping = {
    code: mapping?.code?.trim() || base.code,
    email: mapping?.email?.trim() || base.email,
  };
  if (kind === 'CODES') {
    if (mapping?.email) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'CODES imports cannot map email',
      );
    }
    delete next.email;
    if (!next.code) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'CODES imports require a code column mapping',
      );
    }
  } else {
    if (mapping?.code) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'GUESTS imports cannot map code',
      );
    }
    delete next.code;
    if (!next.email) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'GUESTS imports require an email column mapping',
      );
    }
  }
  return next;
}

function headerIndex(headers: string[], name: string | undefined): number {
  if (!name) return -1;
  const target = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === target);
}

function canonicalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

function maskCodeHint(raw: string): string {
  const t = raw.trim();
  if (t.length <= 2) return '**';
  return `${t.slice(0, 1)}***`;
}

async function lockEvent(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<{ id: string; status: string }> {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM events
    WHERE tenant_id = ${tenantId}::uuid AND id = ${eventId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new ImportError(
      IMPORT_ERROR_CODES.EVENT_NOT_FOUND,
      'Event not found',
      404,
    );
  }
  if (row.status === 'CLOSED' || row.status === 'ARCHIVED') {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_SOURCE_INVALID,
      'Event is closed',
    );
  }
  return row;
}

async function assertSourceTypePair(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    eventId: string;
    sourceId: string;
    ticketTypeId: string;
  },
): Promise<void> {
  const sources = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM issuance_sources
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.sourceId}::uuid
  `;
  if (!sources[0]) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_SOURCE_INVALID,
      'Issuance source not found for event',
    );
  }
  const types = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM ticket_types
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND id = ${input.ticketTypeId}::uuid
  `;
  if (!types[0]) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_TYPE_INVALID,
      'Ticket type not found for event',
    );
  }
  const map = await tx.$queryRaw<Array<{ ok: number }>>`
    SELECT 1 AS ok FROM source_ticket_types
    WHERE tenant_id = ${input.tenantId}::uuid
      AND event_id = ${input.eventId}::uuid
      AND source_id = ${input.sourceId}::uuid
      AND ticket_type_id = ${input.ticketTypeId}::uuid
  `;
  if (!map[0]) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_TYPE_INVALID,
      'Ticket type is not mapped to the issuance source',
    );
  }
}

async function rowLimitForTenant(
  tx: Prisma.TransactionClient,
  tenantId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<
    Array<{ import_rows_per_job: number | null; imports_enabled: boolean }>
  >`
    SELECT import_rows_per_job, imports_enabled
    FROM tenant_limits
    WHERE tenant_id = ${tenantId}::uuid
  `;
  const row = rows[0];
  if (row && row.imports_enabled === false) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'Imports are disabled for this tenant',
      403,
    );
  }
  const tenantCap = row?.import_rows_per_job ?? null;
  if (tenantCap === null) return IMPORT_LIMITS.maxRows;
  return Math.min(IMPORT_LIMITS.maxRows, tenantCap);
}

async function readEventRemainingQuota(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<
    Array<{ capacity: number | null; allocated: number }>
  >`
    SELECT capacity, allocated
    FROM quota_buckets
    WHERE tenant_id = ${tenantId}::uuid
      AND event_id = ${eventId}::uuid
      AND scope = 'EVENT'
  `;
  const row = rows[0];
  if (!row || row.capacity === null) return 0;
  return Math.max(0, row.capacity - row.allocated);
}

function toJobDto(row: JobRow, replayed?: boolean): ImportJob {
  const dto: ImportJob = {
    importId: row.id,
    kind: row.kind,
    status: row.status,
    sourceId: row.source_id,
    ticketTypeId: row.ticket_type_id,
    fileHash: row.file_hash,
    mappingRevision: row.mapping_revision,
    previewRevision: row.preview_revision,
    validRowCount: row.valid_row_count,
    errorRowCount: row.error_row_count,
    invitationCount: row.invitation_count,
    estimatedQuota: row.estimated_quota,
  };
  if (replayed) dto.replayed = true;
  return dto;
}

type ValidParsedRow = { ok: true; line: number; value: string };

type ParseResult = {
  valid: ValidParsedRow[];
  errors: FieldValidationError[];
  errorCsv: string;
};

function parsePayload(
  kind: ImportKind,
  mapping: ImportColumnMapping,
  text: string,
  maxRows: number,
): ParseResult {
  const grid = parseCsvRows(text);
  if (grid.length < 2) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'CSV must include a header row and at least one data row',
    );
  }
  const headers = grid[0]!.map((h) => h.trim());
  const field = kind === 'CODES' ? 'code' : 'email';
  const colName = kind === 'CODES' ? mapping.code : mapping.email;
  const idx = headerIndex(headers, colName);
  if (idx < 0) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      `Mapped column "${colName}" not found in CSV header`,
    );
  }
  const dataRows = grid.slice(1);
  if (dataRows.length > maxRows) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      `Import exceeds ${maxRows} rows`,
    );
  }
  const valid: ValidParsedRow[] = [];
  const errors: FieldValidationError[] = [];
  const seen = new Set<string>();
  const csvLines = [toCsvRow(['line', 'fieldId', 'code', 'message'])];

  for (let i = 0; i < dataRows.length; i++) {
    const line = i + 2;
    const raw = (dataRows[i]![idx] ?? '').trim();
    const fieldId = `row:${line}:${field}`;
    if (!raw) {
      const err: FieldValidationError = {
        fieldId,
        code: 'EMPTY',
        message: `${field} is required`,
      };
      errors.push(err);
      csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
      continue;
    }
    if (kind === 'GUESTS') {
      const email = canonicalizeEmail(raw);
      if (!isValidEmail(email)) {
        const err: FieldValidationError = {
          fieldId,
          code: 'EMAIL_INVALID',
          message: 'Email format is invalid',
        };
        errors.push(err);
        csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
        continue;
      }
      if (seen.has(email)) {
        const err: FieldValidationError = {
          fieldId,
          code: 'DUPLICATE_IN_FILE',
          message: 'Duplicate email in file',
        };
        errors.push(err);
        csvLines.push(toCsvRow([line, fieldId, err.code, err.message]));
        continue;
      }
      seen.add(email);
      valid.push({ ok: true, line, value: email });
      continue;
    }
    const code = raw;
    const key = code.toUpperCase();
    if (seen.has(key)) {
      const err: FieldValidationError = {
        fieldId,
        code: 'DUPLICATE_IN_FILE',
        message: 'Duplicate code in file',
      };
      errors.push(err);
      csvLines.push(
        toCsvRow([
          line,
          fieldId,
          err.code,
          `${err.message} (${maskCodeHint(code)})`,
        ]),
      );
      continue;
    }
    seen.add(key);
    valid.push({ ok: true, line, value: code });
  }

  return {
    valid,
    errors,
    errorCsv: csvLines.join('\n') + '\n',
  };
}

export async function uploadImportFile(
  db: PrismaClient,
  store: ObjectStore,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    kind: ImportKind;
    filename: string;
    contentType: string | undefined;
    body: Buffer;
  },
): Promise<ImportFileUploadResponse> {
  if (input.kind !== 'CODES' && input.kind !== 'GUESTS') {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'kind must be CODES or GUESTS',
    );
  }
  const lower = input.filename.toLowerCase();
  const ct = (input.contentType ?? '').toLowerCase();
  if (
    !lower.endsWith('.csv') &&
    !ct.includes('csv') &&
    !ct.includes('text/plain') &&
    ct !== ''
  ) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'Only UTF-8 CSV files are accepted',
    );
  }
  assertUtf8Csv(input.body);
  const fileHash = sha256Hex(input.body);
  const fileId = randomUUID();
  const objectKey = quarantineKey(input.tenantId, input.eventId, fileId);
  const expiresAt = new Date(
    Date.now() + IMPORT_ERROR_REPORT_TTL_HOURS_DEV * 3600 * 1000,
  );

  await withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    await lockEvent(tx, input.tenantId, input.eventId);
    await tx.$executeRaw`
      INSERT INTO import_files (
        tenant_id, event_id, id, kind, object_key, file_hash, byte_length,
        created_by, expires_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${fileId}::uuid,
        ${input.kind}, ${objectKey}, ${fileHash}, ${input.body.length},
        ${input.actorUserId}::uuid, ${expiresAt}::timestamptz
      )
    `;
  });

  await store.putObject(objectKey, input.body, 'text/csv; charset=utf-8');

  return {
    fileId,
    fileHash,
    byteLength: input.body.length,
  };
}

export async function createImportJob(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    body: ImportCreateBody;
    idempotencyKey: string;
  },
): Promise<ImportJob> {
  const key = requireIdempotencyKey(input.idempotencyKey);
  const kind = input.body.kind;
  if (kind !== 'CODES' && kind !== 'GUESTS') {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'kind must be CODES or GUESTS',
    );
  }
  const sourceId = requireUuid(input.body.sourceId, 'sourceId');
  const ticketTypeId = requireUuid(input.body.ticketTypeId, 'ticketTypeId');
  const fileId = input.body.fileId
    ? requireUuid(input.body.fileId, 'fileId')
    : undefined;
  const rawCodes = input.body.rawCodes;
  if (!fileId && (!rawCodes || rawCodes.length === 0)) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'fileId or rawCodes is required',
    );
  }
  if (rawCodes && rawCodes.length > 500) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      'rawCodes exceeds 500',
    );
  }
  if (kind === 'GUESTS' && rawCodes) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'GUESTS imports require fileId CSV upload',
    );
  }
  const mapping = normalizeMapping(kind, input.body.columnMapping);
  const mappingRevision =
    input.body.mappingRevision === undefined
      ? 1
      : Number(input.body.mappingRevision);
  if (!Number.isInteger(mappingRevision) || mappingRevision < 1) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'mappingRevision must be a positive integer',
    );
  }

  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    await lockEvent(tx, input.tenantId, input.eventId);
    await assertSourceTypePair(tx, {
      tenantId: input.tenantId,
      eventId: input.eventId,
      sourceId,
      ticketTypeId,
    });

    const requestHash = sha256Hex(
      Buffer.from(
        JSON.stringify({
          kind,
          sourceId,
          ticketTypeId,
          fileId: fileId ?? null,
          rawCodes: rawCodes ?? null,
          mappingRevision,
          columnMapping: mapping,
        }),
      ),
    );
    const importId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO operations (
        tenant_id, event_id, id, actor_user_id, command, client_key,
        request_hash, status, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${importId}::uuid,
        ${input.actorUserId}::uuid, 'import.create', ${key},
        ${requestHash}, 'IN_PROGRESS', now(), now()
      )
      ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
      DO NOTHING
    `;
    const ops = await tx.$queryRaw<
      Array<{
        id: string;
        request_hash: string;
        status: string;
        response_json: ImportJob | null;
      }>
    >`
      SELECT id, request_hash, status, response_json
      FROM operations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
        AND command = 'import.create'
        AND client_key = ${key}
      FOR UPDATE
    `;
    const op = ops[0];
    if (!op) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Failed to claim idempotency operation',
        409,
      );
    }
    if (op.request_hash !== requestHash) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Idempotency-Key was reused with a different request',
        409,
      );
    }
    if (op.status === 'COMPLETED' && op.response_json) {
      return { ...op.response_json, replayed: true };
    }

    let fileHash: string | null = null;
    if (fileId) {
      const files = await tx.$queryRaw<
        Array<{ id: string; kind: string; file_hash: string; event_id: string }>
      >`
        SELECT id, kind, file_hash, event_id FROM import_files
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${fileId}::uuid
        FOR UPDATE
      `;
      const file = files[0];
      if (!file || file.event_id !== input.eventId) {
        throw new ImportError(
          IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
          'Import file not found',
          404,
        );
      }
      if (file.kind !== kind) {
        throw new ImportError(
          IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
          'fileId kind does not match job kind',
        );
      }
      fileHash = file.file_hash;
    } else if (rawCodes) {
      fileHash = sha256Hex(Buffer.from(JSON.stringify(rawCodes), 'utf8'));
    }

    await tx.$executeRaw`
      INSERT INTO import_jobs (
        tenant_id, event_id, id, kind, status, source_id, ticket_type_id,
        file_id, file_hash, raw_codes_json, mapping_revision, column_mapping,
        created_by
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${importId}::uuid,
        ${kind}, 'CREATED', ${sourceId}::uuid, ${ticketTypeId}::uuid,
        ${fileId ?? null}::uuid, ${fileHash},
        ${rawCodes ? JSON.stringify(rawCodes) : null}::jsonb,
        ${mappingRevision}, ${JSON.stringify(mapping)}::jsonb,
        ${input.actorUserId}::uuid
      )
    `;

    const job: ImportJob = {
      importId,
      kind,
      status: 'CREATED',
      sourceId,
      ticketTypeId,
      fileHash,
      mappingRevision,
      previewRevision: null,
      validRowCount: null,
      errorRowCount: null,
      invitationCount: null,
      estimatedQuota: null,
    };
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify(job)}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${op.id}::uuid
    `;
    return job;
  });
}

async function loadJob(
  tx: Prisma.TransactionClient,
  tenantId: string,
  eventId: string,
  importId: string,
): Promise<JobRow> {
  const rows = await tx.$queryRaw<JobRow[]>`
    SELECT id, event_id, kind, status, source_id, ticket_type_id, file_id,
           file_hash, raw_codes_json, mapping_revision, column_mapping,
           preview_revision, valid_row_count, error_row_count, invitation_count,
           estimated_quota, sample_errors, error_report_csv,
           error_report_expires_at, commit_response
    FROM import_jobs
    WHERE tenant_id = ${tenantId}::uuid AND id = ${importId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row || row.event_id !== eventId) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_NOT_FOUND,
      'Import job not found',
      404,
    );
  }
  return row;
}

async function loadCsvText(
  tx: Prisma.TransactionClient,
  store: ObjectStore,
  tenantId: string,
  job: JobRow,
): Promise<string> {
  if (job.raw_codes_json) {
    const codes = job.raw_codes_json as string[];
    const lines = ['code', ...codes.map((c) => String(c))];
    return lines.join('\n');
  }
  if (!job.file_id) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'Import job has no file',
    );
  }
  const files = await tx.$queryRaw<Array<{ object_key: string }>>`
    SELECT object_key FROM import_files
    WHERE tenant_id = ${tenantId}::uuid AND id = ${job.file_id}::uuid
  `;
  const file = files[0];
  if (!file) {
    throw new ImportError(
      IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      'Import file missing',
      404,
    );
  }
  const buf = await store.getObject(file.object_key);
  return assertUtf8Csv(buf);
}

export async function getImportJob(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    importId: string;
  },
): Promise<ImportJob> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    const row = await loadJob(
      tx,
      input.tenantId,
      input.eventId,
      input.importId,
    );
    return toJobDto(row);
  });
}

/** Read-only projection. Authorization and the keyset query share one tenant RLS transaction. */
export async function listImportJobs(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    query: ImportJobListQuery;
  },
  cursorSecret: string,
): Promise<ImportJobListPage> {
  const { tenantId, eventId, actorUserId, query } = input;
  const limit = query.limit ?? CURSOR_PAGE_LIMIT.default;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > CURSOR_PAGE_LIMIT.max ||
    (query.status !== undefined &&
      ![
        'CREATED',
        'PREVIEW_READY',
        'COMMITTING',
        'COMPLETED',
        'FAILED',
      ].includes(query.status)) ||
    (query.kind !== undefined && !['CODES', 'GUESTS'].includes(query.kind))
  ) {
    throw new ImportError(
      IMPORT_ERROR_CODES.INVALID_FILTER,
      'Invalid import list filter',
    );
  }
  const status = query.status ?? null;
  const kind = query.kind ?? null;
  return withTenant(db, tenantId, async (tx) => {
    try {
      await requireTenantPermission(tx, {
        tenantId,
        eventId,
        userId: actorUserId,
        permission: PERMISSION_IMPORT,
      });
    } catch (error) {
      if (
        error instanceof AuthzError &&
        error.code === AUTHZ_ERROR_CODES.EVENT_ASSIGNMENT_REQUIRED
      ) {
        throw new ImportError(
          IMPORT_ERROR_CODES.EVENT_NOT_FOUND,
          'Event not found',
          404,
        );
      }
      throw error;
    }
    const anchor =
      query.cursor === undefined
        ? null
        : decodeJobCursor(
            query.cursor,
            cursorSecret,
            tenantId,
            eventId,
            status,
            kind,
          );
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        kind: ImportKind;
        status: ImportJobStatus;
        source_id: string;
        ticket_type_id: string;
        mapping_revision: number | null;
        preview_revision: number | null;
        valid_row_count: number | null;
        error_row_count: number | null;
        invitation_count: number | null;
        estimated_quota: number | null;
        created_at: Date;
        cursor_created_at: string;
      }>
    >`
      SELECT id, kind, status, source_id, ticket_type_id, mapping_revision,
             preview_revision, valid_row_count, error_row_count, invitation_count,
             estimated_quota, created_at, created_at::text AS cursor_created_at
      FROM import_jobs
      WHERE tenant_id = ${tenantId}::uuid AND event_id = ${eventId}::uuid
        AND (${status}::text IS NULL OR status = ${status})
        AND (${kind}::text IS NULL OR kind = ${kind})
        AND (${anchor?.createdAt ?? null}::text IS NULL OR
             (created_at, id) < (${anchor?.createdAt ?? null}::timestamptz, ${anchor?.id ?? null}::uuid))
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;
    const page = rows.slice(0, limit);
    const items: ImportJobSummary[] = page.map((row) => ({
      importId: row.id,
      kind: row.kind,
      status: row.status,
      sourceId: row.source_id,
      ticketTypeId: row.ticket_type_id,
      mappingRevision: row.mapping_revision,
      previewRevision: row.preview_revision,
      validRowCount: row.valid_row_count,
      errorRowCount: row.error_row_count,
      invitationCount: row.invitation_count,
      estimatedQuota: row.estimated_quota,
      createdAt: row.created_at.toISOString(),
    }));
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeJobCursor(
              [
                1,
                tenantId,
                eventId,
                status,
                kind,
                last.cursor_created_at,
                last.id,
              ],
              cursorSecret,
            )
          : null,
    };
  });
}

export async function previewImportJob(
  db: PrismaClient,
  store: ObjectStore,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    importId: string;
    body?: ImportPreviewBody;
  },
): Promise<ImportPreviewResponse> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    await lockEvent(tx, input.tenantId, input.eventId);
    const job = await loadJob(
      tx,
      input.tenantId,
      input.eventId,
      input.importId,
    );
    if (job.status === 'COMPLETED' || job.status === 'COMMITTING') {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        'Import job is no longer previewable',
      );
    }

    let mapping = (job.column_mapping ?? {}) as ImportColumnMapping;
    let mappingRevision = job.mapping_revision ?? 1;
    if (input.body?.columnMapping) {
      mapping = normalizeMapping(job.kind, {
        ...mapping,
        ...input.body.columnMapping,
      });
      mappingRevision += 1;
    } else {
      mapping = normalizeMapping(job.kind, mapping);
    }
    if (
      input.body?.mappingRevision !== undefined &&
      Number(input.body.mappingRevision) !== mappingRevision &&
      input.body.columnMapping === undefined
    ) {
      // Client sent stale mappingRevision without a mapping bump.
      if (Number(input.body.mappingRevision) !== (job.mapping_revision ?? 1)) {
        throw new ImportError(
          IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
          'mappingRevision does not match stored revision',
        );
      }
    }

    const maxRows = await rowLimitForTenant(tx, input.tenantId);
    const text = await loadCsvText(tx, store, input.tenantId, job);
    const parsed = parsePayload(job.kind, mapping, text, maxRows);

    // Cross-check existing duplicates without mutating (no quota writes).
    const filteredValid: ValidParsedRow[] = [];
    for (const row of parsed.valid) {
      if (job.kind === 'CODES') {
        // Defer HMAC uniqueness to commit (pepper available only there via caller).
        // Preview still rejects empty/dup-in-file; commit skips existing HMACs.
        filteredValid.push(row);
      } else {
        const existing = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM guest_invitations
          WHERE tenant_id = ${input.tenantId}::uuid
            AND event_id = ${input.eventId}::uuid
            AND invited_email = ${row.value}
            AND state IN ('PENDING', 'DISPATCHED', 'CLAIMED')
          LIMIT 1
        `;
        if (existing[0]) {
          const err: FieldValidationError = {
            fieldId: `row:${row.line}:email`,
            code: 'DUPLICATE_IN_EVENT',
            message: 'Email already invited for this event',
          };
          parsed.errors.push(err);
        } else {
          filteredValid.push(row);
        }
      }
    }

    const remaining = await readEventRemainingQuota(
      tx,
      input.tenantId,
      input.eventId,
    );
    const estimatedQuota = Math.min(filteredValid.length, remaining);
    const previewRevision = (job.preview_revision ?? 0) + 1;
    const invitationCount = job.kind === 'GUESTS' ? filteredValid.length : 0;
    const sampleErrors = parsed.errors.slice(0, SAMPLE_ERROR_LIMIT);
    const errorExpires = new Date(
      Date.now() + IMPORT_ERROR_REPORT_TTL_HOURS_DEV * 3600 * 1000,
    );

    // Preview must NOT touch quota_buckets.allocated — only update job metadata.
    await tx.$executeRaw`
      UPDATE import_jobs
      SET status = 'PREVIEW_READY',
          mapping_revision = ${mappingRevision},
          column_mapping = ${JSON.stringify(mapping)}::jsonb,
          preview_revision = ${previewRevision},
          valid_row_count = ${filteredValid.length},
          error_row_count = ${parsed.errors.length},
          invitation_count = ${invitationCount},
          estimated_quota = ${estimatedQuota},
          sample_errors = ${JSON.stringify(sampleErrors)}::jsonb,
          error_report_csv = ${parsed.errorCsv},
          error_report_expires_at = ${errorExpires}::timestamptz,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${job.id}::uuid
    `;

    if (!job.file_hash) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'Import job missing fileHash',
      );
    }

    return {
      importId: job.id,
      previewRevision,
      mappingRevision,
      fileHash: job.file_hash,
      validRowCount: filteredValid.length,
      errorRowCount: parsed.errors.length,
      invitationCount,
      estimatedQuota,
      sampleErrors,
    };
  });
}

export async function commitImportJob(
  db: PrismaClient,
  store: ObjectStore,
  hmac: CodeHmacConfig,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    importId: string;
    body: ImportCommitBody;
    idempotencyKey: string;
  },
): Promise<ImportCommitResponse> {
  const key = requireIdempotencyKey(input.idempotencyKey);
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    await lockEvent(tx, input.tenantId, input.eventId);

    const requestHash = sha256Hex(
      Buffer.from(
        JSON.stringify({
          importId: input.importId,
          ...input.body,
        }),
      ),
    );
    const operationId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO operations (
        tenant_id, event_id, id, actor_user_id, command, client_key,
        request_hash, status, created_at, updated_at
      ) VALUES (
        ${input.tenantId}::uuid, ${input.eventId}::uuid, ${operationId}::uuid,
        ${input.actorUserId}::uuid, ${COMMIT_COMMAND}, ${key},
        ${requestHash}, 'IN_PROGRESS', now(), now()
      )
      ON CONFLICT (tenant_id, event_id, actor_user_id, command, client_key)
      DO NOTHING
    `;
    const ops = await tx.$queryRaw<
      Array<{
        id: string;
        request_hash: string;
        status: string;
        response_json: ImportCommitResponse | null;
      }>
    >`
      SELECT id, request_hash, status, response_json
      FROM operations
      WHERE tenant_id = ${input.tenantId}::uuid
        AND event_id = ${input.eventId}::uuid
        AND actor_user_id = ${input.actorUserId}::uuid
        AND command = ${COMMIT_COMMAND}
        AND client_key = ${key}
      FOR UPDATE
    `;
    const op = ops[0];
    if (!op) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Failed to claim idempotency operation',
        409,
      );
    }
    if (op.request_hash !== requestHash) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        'Idempotency-Key was reused with a different request',
        409,
      );
    }
    if (op.status === 'COMPLETED' && op.response_json) {
      return { ...op.response_json, replayed: true };
    }

    const job = await loadJob(
      tx,
      input.tenantId,
      input.eventId,
      input.importId,
    );
    if (job.status === 'COMPLETED' && job.commit_response) {
      const replay = { ...job.commit_response, replayed: true };
      await tx.$executeRaw`
        UPDATE operations
        SET status = 'COMPLETED',
            response_json = ${JSON.stringify(replay)}::jsonb,
            updated_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${op.id}::uuid
      `;
      return replay;
    }
    if (job.status !== 'PREVIEW_READY') {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        'Import job must be PREVIEW_READY before commit',
      );
    }
    if (
      job.preview_revision !== input.body.previewRevision ||
      job.mapping_revision !== input.body.mappingRevision ||
      job.file_hash !== input.body.fileHash
    ) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_STALE_PREVIEW,
        'previewRevision, mappingRevision, or fileHash is stale',
      );
    }

    await tx.$executeRaw`
      UPDATE import_jobs
      SET status = 'COMMITTING', updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${job.id}::uuid
    `;

    const mapping = normalizeMapping(
      job.kind,
      job.column_mapping as ImportColumnMapping,
    );
    const maxRows = await rowLimitForTenant(tx, input.tenantId);
    const text = await loadCsvText(tx, store, input.tenantId, job);
    const parsed = parsePayload(job.kind, mapping, text, maxRows);

    let committed = 0;
    let skipped = 0;
    let invitationCount = 0;

    if (job.kind === 'CODES') {
      for (const row of parsed.valid) {
        const codeHmac = hashRedemptionCode(hmac, row.value);
        const id = randomUUID();
        const inserted = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO redemption_codes (
            tenant_id, event_id, id, code_hmac, code_pepper_version,
            source_id, ticket_type_id, status, created_at, updated_at
          ) VALUES (
            ${input.tenantId}::uuid, ${input.eventId}::uuid, ${id}::uuid,
            ${codeHmac}, ${hmac.version}, ${job.source_id}::uuid,
            ${job.ticket_type_id}::uuid, 'AVAILABLE', now(), now()
          )
          ON CONFLICT (tenant_id, event_id, code_hmac) DO NOTHING
          RETURNING id
        `;
        if (inserted[0]) {
          committed += 1;
        } else {
          skipped += 1;
        }
      }
    } else {
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
      for (const row of parsed.valid) {
        const invitationId = randomUUID();
        const rawToken = randomBytes(32).toString('base64url');
        const tokenHash = createHash('sha256')
          .update(rawToken, 'utf8')
          .digest('hex');
        const inserted = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO guest_invitations (
            tenant_id, event_id, id, import_job_id, source_id, ticket_type_id,
            invited_email, token_hash, state, expires_at
          ) VALUES (
            ${input.tenantId}::uuid, ${input.eventId}::uuid, ${invitationId}::uuid,
            ${job.id}::uuid, ${job.source_id}::uuid, ${job.ticket_type_id}::uuid,
            ${row.value}, ${tokenHash}, 'PENDING', ${expiresAt}::timestamptz
          )
          ON CONFLICT (tenant_id, event_id, invited_email) DO NOTHING
          RETURNING id
        `;
        if (!inserted[0]) {
          skipped += 1;
          continue;
        }
        // Store raw token only in outbox payload for later dispatch — never return it.
        await tx.$executeRaw`
          INSERT INTO outbox (
            tenant_id, event_id, id, type, aggregate_id, payload_version,
            payload, status, attempts, created_at, updated_at
          ) VALUES (
            ${input.tenantId}::uuid, ${input.eventId}::uuid, ${randomUUID()}::uuid,
            'InvitationTokenMinted', ${invitationId}::uuid, 1,
            ${JSON.stringify({
              invitationId,
              token: rawToken,
              email: row.value,
            })}::jsonb,
            'PENDING', 0, now(), now()
          )
        `;
        committed += 1;
        invitationCount += 1;
      }
    }

    const response: ImportCommitResponse = {
      importId: job.id,
      status: 'COMPLETED',
      committedRowCount: committed,
      skippedRowCount: skipped,
      errorRowCount: parsed.errors.length,
      invitationCount,
      replayed: false,
    };

    await tx.$executeRaw`
      UPDATE import_jobs
      SET status = 'COMPLETED',
          commit_response = ${JSON.stringify(response)}::jsonb,
          invitation_count = ${invitationCount},
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${job.id}::uuid
    `;
    if (job.file_id) {
      await tx.$executeRaw`
        UPDATE import_files
        SET consumed_at = now()
        WHERE tenant_id = ${input.tenantId}::uuid AND id = ${job.file_id}::uuid
      `;
    }
    await tx.$executeRaw`
      UPDATE operations
      SET status = 'COMPLETED',
          response_json = ${JSON.stringify(response)}::jsonb,
          updated_at = now()
      WHERE tenant_id = ${input.tenantId}::uuid AND id = ${op.id}::uuid
    `;
    return response;
  });
}

export async function downloadImportErrors(
  db: PrismaClient,
  input: {
    tenantId: string;
    eventId: string;
    actorUserId: string;
    importId: string;
  },
): Promise<{ csv: string; expiresAt: string }> {
  return withTenant(db, input.tenantId, async (tx) => {
    await requireTenantPermission(tx, {
      tenantId: input.tenantId,
      userId: input.actorUserId,
      permission: PERMISSION_IMPORT,
      eventId: input.eventId,
    });
    const job = await loadJob(
      tx,
      input.tenantId,
      input.eventId,
      input.importId,
    );
    if (!job.error_report_csv || !job.error_report_expires_at) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_NOT_FOUND,
        'Error report not available',
        404,
      );
    }
    if (job.error_report_expires_at.getTime() < Date.now()) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_NOT_FOUND,
        'Error report expired',
        410,
      );
    }
    // Fail closed: never embed object keys / URLs in the CSV body.
    if (
      /https?:\/\//i.test(job.error_report_csv) ||
      /presign|uploadUrl|object_key/i.test(job.error_report_csv)
    ) {
      throw new ImportError(
        IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        'Error report failed privacy check',
      );
    }
    return {
      csv: job.error_report_csv,
      expiresAt: job.error_report_expires_at.toISOString(),
    };
  });
}

/** Worker helper: delete expired unconsumed quarantine objects metadata. */
export async function cleanupExpiredImportFiles(
  db: PrismaClient,
  store: ObjectStore,
  limit = 50,
): Promise<number> {
  const rows = await db.$queryRaw<
    Array<{ tenant_id: string; id: string; object_key: string }>
  >`
    SELECT tenant_id, id, object_key
    FROM import_files
    WHERE consumed_at IS NULL
      AND expires_at < clock_timestamp()
    ORDER BY expires_at
    LIMIT ${limit}
  `;
  let n = 0;
  for (const row of rows) {
    try {
      // Best-effort object delete via overwrite empty not available — drop DB row.
      // Object store may retain until O06 retention sweeper.
      void store;
      await withTenant(db, row.tenant_id, async (tx) => {
        await tx.$executeRaw`
          DELETE FROM import_files
          WHERE tenant_id = ${row.tenant_id}::uuid AND id = ${row.id}::uuid
            AND consumed_at IS NULL
        `;
      });
      n += 1;
    } catch {
      /* ignore single-row failure */
    }
  }
  return n;
}
