/**
 * C-I CSV import job helpers — paths, interpreters, template/mapping.
 * Preview never writes business state; commit is idempotent by revision/hash.
 */

import {
  IMPORT_ERROR_CODES,
  IMPORT_LIMITS,
  type FieldValidationError,
  type ImportCommitResponse,
  type ImportJob,
  type ImportJobStatus,
  type ImportKind,
  type ImportPreviewResponse,
} from '@ticket/contracts';
import {
  apiErrorFrom,
  asRecord,
  isNonEmptyString,
  optionalNumber,
} from './contract-shape';
import type { AdminScope } from './scope';
import { eventPath } from './scope';

export const IMPORT_UNKNOWN =
  'Kết quả import chưa biết. Không coi là đã preview hoặc đã commit.';

/** Allowlisted CSV columns (UTF-8 templates). */
export const CSV_COLUMN_CODES = ['code'] as const;
export const CSV_COLUMN_GUESTS = ['email'] as const;

export type CsvMappedField = 'code' | 'email';

export type CsvColumnMapping = Partial<Record<CsvMappedField, string>>;

export type ImportFileUploadResponse = {
  fileId: string;
  fileHash: string;
  byteLength: number;
};

export type ImportView =
  | { kind: 'job'; job: ImportJob }
  | { kind: 'preview'; preview: ImportPreviewResponse }
  | { kind: 'commit'; commit: ImportCommitResponse }
  | {
      kind: 'errors';
      importId: string;
      contentType: string;
      byteLength: number;
      filename: string | null;
    }
  | { kind: 'upload'; file: ImportFileUploadResponse }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

const JOB_STATUSES = new Set<ImportJobStatus>([
  'CREATED',
  'PREVIEW_READY',
  'COMMITTING',
  'COMPLETED',
  'FAILED',
]);

function isImportKind(value: unknown): value is ImportKind {
  return value === 'CODES' || value === 'GUESTS';
}

function isJobStatus(value: unknown): value is ImportJobStatus {
  return typeof value === 'string' && JOB_STATUSES.has(value as ImportJobStatus);
}

function fieldsFrom(body: Record<string, unknown>): FieldValidationError[] {
  const raw = Array.isArray(body.sampleErrors)
    ? body.sampleErrors
    : Array.isArray(body.fields)
      ? body.fields
      : [];
  const out: FieldValidationError[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    if (
      typeof row.fieldId === 'string' &&
      typeof row.code === 'string' &&
      typeof row.message === 'string'
    ) {
      out.push({
        fieldId: row.fieldId,
        code: row.code,
        message: row.message,
      });
    }
  }
  return out;
}

export function importsCreatePath(scope: AdminScope): string {
  return eventPath(scope, 'imports');
}

export function importsUploadPath(scope: AdminScope): string {
  return eventPath(scope, 'imports/files');
}

export function importJobPath(scope: AdminScope, importId: string): string {
  return `${importsCreatePath(scope)}/${encodeURIComponent(importId)}`;
}

export function importPreviewPath(scope: AdminScope, importId: string): string {
  return `${importJobPath(scope, importId)}/preview`;
}

export function importCommitPath(scope: AdminScope, importId: string): string {
  return `${importJobPath(scope, importId)}/commit`;
}

export function importErrorsPath(scope: AdminScope, importId: string): string {
  return `${importJobPath(scope, importId)}/errors`;
}

/** Downloadable UTF-8 template (BOM-free). */
export function csvTemplateForKind(kind: ImportKind): string {
  if (kind === 'GUESTS') {
    return 'email\nguest@example.com\n';
  }
  return 'code\nSAMPLE-CODE-001\n';
}

export function csvTemplateFilename(kind: ImportKind): string {
  return kind === 'GUESTS'
    ? 'vemoki-import-guests.csv'
    : 'vemoki-import-codes.csv';
}

export type CsvParseResult =
  | {
      ok: true;
      headers: string[];
      rowCount: number;
      byteLength: number;
      mapping: CsvColumnMapping;
      mappingRevision: number;
    }
  | { ok: false; code: string; message: string };

/**
 * Client-side CSV gate (UTF-8 / size / row cap). Does not write business data.
 * Mapping maps allowlisted fields → header names present in the file.
 */
export function parseCsvForImport(input: {
  kind: ImportKind;
  text: string;
  mapping?: CsvColumnMapping;
  mappingRevision?: number;
}): CsvParseResult {
  const byteLength = new TextEncoder().encode(input.text).byteLength;
  if (byteLength > IMPORT_LIMITS.maxBytes) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: `CSV vượt ${IMPORT_LIMITS.maxBytes} bytes.`,
    };
  }
  if (input.text.includes('\u0000')) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      message: 'CSV phải là UTF-8 text, không chứa null byte.',
    };
  }

  const lines = input.text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      message: 'CSV trống.',
    };
  }

  const headers = splitCsvLine(nonEmpty[0] ?? '');
  const dataRows = nonEmpty.length - 1;
  if (dataRows > IMPORT_LIMITS.maxRows) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: `CSV vượt ${IMPORT_LIMITS.maxRows} dòng.`,
    };
  }

  const required: CsvMappedField[] =
    input.kind === 'GUESTS' ? ['email'] : ['code'];
  const mapping: CsvColumnMapping = { ...(input.mapping ?? {}) };
  for (const field of required) {
    if (!mapping[field]) {
      const match = headers.find(
        (h) => h.trim().toLowerCase() === field,
      );
      if (match) mapping[field] = match;
    }
  }
  for (const field of required) {
    const header = mapping[field]?.trim() ?? '';
    if (!header || !headers.includes(header)) {
      return {
        ok: false,
        code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
        message: `Thiếu cột bắt buộc «${field}» (template/mapping).`,
      };
    }
  }

  return {
    ok: true,
    headers,
    rowCount: dataRows,
    byteLength,
    mapping,
    mappingRevision: input.mappingRevision ?? 1,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Extract legacy rawCodes (≤500) from a mapped CODES CSV — not a full CSV job. */
export function extractRawCodesFromCsv(
  text: string,
  codeHeader: string,
  max = 500,
): string[] | { code: string; message: string } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length < 2) {
    return { code: 'CODES_REQUIRED', message: 'CSV cần ít nhất một dòng mã.' };
  }
  const headers = splitCsvLine(nonEmpty[0] ?? '');
  const idx = headers.indexOf(codeHeader);
  if (idx < 0) {
    return { code: 'CODES_REQUIRED', message: 'Không tìm thấy cột code.' };
  }
  const codes: string[] = [];
  for (let r = 1; r < nonEmpty.length; r += 1) {
    const cols = splitCsvLine(nonEmpty[r] ?? '');
    const code = (cols[idx] ?? '').trim();
    if (code) codes.push(code);
  }
  if (codes.length === 0) {
    return { code: 'CODES_REQUIRED', message: 'Không có mã hợp lệ.' };
  }
  if (codes.length > max) {
    return {
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: `Legacy rawCodes tối đa ${max}; dùng CSV job + fileId.`,
    };
  }
  return codes;
}

function parseImportJob(json: unknown): ImportJob | null {
  const body = asRecord(json);
  if (!body) return null;
  if (!isNonEmptyString(body.importId)) return null;
  if (!isImportKind(body.kind) || !isJobStatus(body.status)) return null;
  if (!isNonEmptyString(body.sourceId) || !isNonEmptyString(body.ticketTypeId)) {
    return null;
  }
  // Fail closed on raw capability / PII leakage.
  if (
    'token' in body ||
    'rawToken' in body ||
    'ownerEmail' in body ||
    'invitedEmail' in body
  ) {
    return null;
  }
  return {
    importId: body.importId.trim(),
    kind: body.kind,
    status: body.status,
    sourceId: body.sourceId.trim(),
    ticketTypeId: body.ticketTypeId.trim(),
    fileHash: typeof body.fileHash === 'string' ? body.fileHash : null,
    mappingRevision: optionalNumber(body.mappingRevision),
    previewRevision: optionalNumber(body.previewRevision),
    validRowCount: optionalNumber(body.validRowCount),
    errorRowCount: optionalNumber(body.errorRowCount),
    invitationCount: optionalNumber(body.invitationCount),
    estimatedQuota: optionalNumber(body.estimatedQuota),
    replayed: typeof body.replayed === 'boolean' ? body.replayed : undefined,
  };
}

function parsePreview(json: unknown): ImportPreviewResponse | null {
  const body = asRecord(json);
  if (!body) return null;
  if (!isNonEmptyString(body.importId) || !isNonEmptyString(body.fileHash)) {
    return null;
  }
  if (
    typeof body.previewRevision !== 'number' ||
    typeof body.mappingRevision !== 'number' ||
    typeof body.validRowCount !== 'number' ||
    typeof body.errorRowCount !== 'number' ||
    typeof body.invitationCount !== 'number' ||
    typeof body.estimatedQuota !== 'number'
  ) {
    return null;
  }
  return {
    importId: body.importId.trim(),
    previewRevision: body.previewRevision,
    mappingRevision: body.mappingRevision,
    fileHash: body.fileHash,
    validRowCount: body.validRowCount,
    errorRowCount: body.errorRowCount,
    invitationCount: body.invitationCount,
    estimatedQuota: body.estimatedQuota,
    sampleErrors: fieldsFrom(body),
  };
}

function parseCommit(json: unknown): ImportCommitResponse | null {
  const body = asRecord(json);
  if (!body) return null;
  if (!isNonEmptyString(body.importId) || body.status !== 'COMPLETED') {
    return null;
  }
  if (
    typeof body.committedRowCount !== 'number' ||
    typeof body.skippedRowCount !== 'number' ||
    typeof body.errorRowCount !== 'number' ||
    typeof body.invitationCount !== 'number' ||
    typeof body.replayed !== 'boolean'
  ) {
    return null;
  }
  return {
    importId: body.importId.trim(),
    status: 'COMPLETED',
    committedRowCount: body.committedRowCount,
    skippedRowCount: body.skippedRowCount,
    errorRowCount: body.errorRowCount,
    invitationCount: body.invitationCount,
    replayed: body.replayed,
  };
}

function parseUpload(json: unknown): ImportFileUploadResponse | null {
  const body = asRecord(json);
  if (!body) return null;
  if (
    !isNonEmptyString(body.fileId) ||
    !isNonEmptyString(body.fileHash) ||
    typeof body.byteLength !== 'number'
  ) {
    return null;
  }
  return {
    fileId: body.fileId.trim(),
    fileHash: body.fileHash.trim(),
    byteLength: body.byteLength,
  };
}

export function interpretImportCreate(
  status: number,
  json: unknown,
  networkError: boolean,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const job = parseImportJob(json);
    if (job) return { kind: 'job', job };
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: IMPORT_UNKNOWN };
}

export function interpretImportStatus(
  status: number,
  json: unknown,
  networkError: boolean,
): ImportView {
  return interpretImportCreate(status, json, networkError);
}

export function interpretImportPreview(
  status: number,
  json: unknown,
  networkError: boolean,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 200) {
    const preview = parsePreview(json);
    if (preview) return { kind: 'preview', preview };
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: IMPORT_UNKNOWN };
}

export function interpretImportCommit(
  status: number,
  json: unknown,
  networkError: boolean,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const commit = parseCommit(json);
    if (commit) return { kind: 'commit', commit };
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: IMPORT_UNKNOWN };
}

export function interpretImportUpload(
  status: number,
  json: unknown,
  networkError: boolean,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const file = parseUpload(json);
    if (file) return { kind: 'upload', file };
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: IMPORT_UNKNOWN };
}

/**
 * Private error report stream — CSV/octet-stream only; JSON url/href is not success.
 */
export function interpretImportErrorsDownload(
  status: number,
  json: unknown,
  networkError: boolean,
  importId: string,
  contentType: string | null,
  byteLength = 0,
  filename: string | null = null,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 200) {
    const ct = (contentType ?? '').toLowerCase();
    if (
      ct.includes('text/csv') ||
      ct.includes('application/octet-stream') ||
      ct.includes('text/plain')
    ) {
      return {
        kind: 'errors',
        importId,
        contentType: contentType ?? 'text/csv',
        byteLength,
        filename,
      };
    }
    return { kind: 'unknown', message: IMPORT_UNKNOWN };
  }
  if (status === 403 || status === 404 || status === 410) {
    const err = apiErrorFrom(asRecord(json));
    if (err) return { kind: 'rejected', ...err };
    return {
      kind: 'rejected',
      code:
        status === 410
          ? 'IMPORT_ERROR_REPORT_EXPIRED'
          : status === 403
            ? 'FORBIDDEN'
            : IMPORT_ERROR_CODES.IMPORT_NOT_FOUND,
      message:
        status === 410
          ? 'Báo cáo lỗi đã hết hạn.'
          : status === 403
            ? 'Không có quyền tải báo cáo lỗi (tenant/event).'
            : 'Không tìm thấy job/báo cáo lỗi.',
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: IMPORT_UNKNOWN };
}

export function importViewLabel(view: ImportView): string {
  if (view.kind === 'job') {
    const j = view.job;
    const quota =
      j.estimatedQuota === null || j.estimatedQuota === undefined
        ? ''
        : ` · ước tính quota ${j.estimatedQuota} (không giữ suất)`;
    const replay = j.replayed ? ' · replay' : '';
    return `Import ${j.importId}: ${j.status}${quota}${replay}. Preview không ghi dữ liệu nghiệp vụ.`;
  }
  if (view.kind === 'preview') {
    const p = view.preview;
    return `Preview rev ${p.previewRevision}: ${p.validRowCount} hợp lệ · ${p.errorRowCount} lỗi · invitation ${p.invitationCount} · ước tính quota ${p.estimatedQuota} (không reserve).`;
  }
  if (view.kind === 'commit') {
    const c = view.commit;
    const replay = c.replayed ? ' · idempotent replay' : '';
    return `Commit xong: ${c.committedRowCount} dòng · bỏ qua ${c.skippedRowCount} · lỗi ${c.errorRowCount} · invitation ${c.invitationCount}${replay}.`;
  }
  if (view.kind === 'errors') {
    const name = view.filename ? ` · ${view.filename}` : '';
    return `Đã tải báo cáo lỗi private (${view.contentType}, ${view.byteLength} bytes)${name}. Không lưu URL dài hạn.`;
  }
  if (view.kind === 'upload') {
    return `File quarantine sẵn sàng · fileId ${view.file.fileId} · ${view.file.byteLength} bytes.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
