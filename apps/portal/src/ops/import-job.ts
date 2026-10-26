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
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

export const IMPORT_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.import.unknown');

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

export function importAlertType(view: ImportView): 'error' | 'warning' | 'success' {
  if (view.kind === 'rejected' || (view.kind === 'job' && view.job.status === 'FAILED')) return 'error';
  if (view.kind === 'unknown' || (view.kind === 'job' && view.job.status !== 'COMPLETED')) return 'warning';
  return 'success';
}

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
}, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): CsvParseResult {
  const byteLength = new TextEncoder().encode(input.text).byteLength;
  if (byteLength > IMPORT_LIMITS.maxBytes) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: t(locale, 'ops.import.csvMaxBytes', { maxBytes: IMPORT_LIMITS.maxBytes }),
    };
  }
  if (input.text.includes('\u0000')) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      message: t(locale, 'ops.h_jr40gu'),
    };
  }

  const lines = input.text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length === 0) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_FILE_INVALID,
      message: t(locale, 'ops.h_1v0wxpt'),
    };
  }

  const headers = splitCsvLine(nonEmpty[0] ?? '');
  const dataRows = nonEmpty.length - 1;
  if (dataRows > IMPORT_LIMITS.maxRows) {
    return {
      ok: false,
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: t(locale, 'ops.import.csvMaxRows', { maxRows: IMPORT_LIMITS.maxRows }),
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
        message: t(locale, 'ops.import.missingColumn', { field }),
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
  max = 500, locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): string[] | { code: string; message: string } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  if (nonEmpty.length < 2) {
    return { code: 'CODES_REQUIRED', message: t(locale, 'ops.h_17ccgto') };
  }
  const headers = splitCsvLine(nonEmpty[0] ?? '');
  const idx = headers.indexOf(codeHeader);
  if (idx < 0) {
    return { code: 'CODES_REQUIRED', message: t(locale, 'ops.h_y208dx') };
  }
  const codes: string[] = [];
  for (let r = 1; r < nonEmpty.length; r += 1) {
    const cols = splitCsvLine(nonEmpty[r] ?? '');
    const code = (cols[idx] ?? '').trim();
    if (code) codes.push(code);
  }
  if (codes.length === 0) {
    return { code: 'CODES_REQUIRED', message: t(locale, 'ops.h_2a3kdd') };
  }
  if (codes.length > max) {
    return {
      code: IMPORT_ERROR_CODES.IMPORT_ROW_LIMIT,
      message: t(locale, 'ops.import.legacyRawCodesMax', { max }),
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
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  if (networkError || status === 0 || status === 429 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  if (status === 200 || status === 201) {
    const job = parseImportJob(json);
    if (job) return { kind: 'job', job };
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
}

export function interpretImportStatus(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  return interpretImportCreate(status, json, networkError, locale);
}

export function interpretImportPreview(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  if (status === 200) {
    const preview = parsePreview(json);
    if (preview) return { kind: 'preview', preview };
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
}

export function interpretImportCommit(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  if (networkError || status === 0 || status === 429 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  if (status === 200 || status === 201) {
    const commit = parseCommit(json);
    if (commit) return { kind: 'commit', commit };
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
}

export function interpretImportUpload(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  if (status === 200 || status === 201) {
    const file = parseUpload(json);
    if (file) return { kind: 'upload', file };
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
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
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ImportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
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
    return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
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
          ? t(locale, 'ops.import.errorsExpired')
          : status === 403
            ? t(locale, 'ops.h_1dgs34w')
            : t(locale, 'ops.h_ern79n'),
    };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.import.unknown') };
}

export function importViewLabel(view: ImportView, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (view.kind === 'job') {
    const j = view.job;
    const quota =
      j.estimatedQuota === null || j.estimatedQuota === undefined
        ? ''
        : t(locale, 'ops.import.quotaEstimateSuffix', { estimatedQuota: j.estimatedQuota });
    const replay = j.replayed ? t(locale, 'ops.import.replaySuffix') : '';
    return t(locale, 'ops.import.jobLabel', { importId: j.importId, status: j.status, quotaSuffix: quota, replaySuffix: replay });
  }
  if (view.kind === 'preview') {
    const p = view.preview;
    return t(locale, 'ops.import.previewLabel', { previewRevision: p.previewRevision, validRowCount: p.validRowCount, errorRowCount: p.errorRowCount, invitationCount: p.invitationCount, estimatedQuota: p.estimatedQuota });
  }
  if (view.kind === 'commit') {
    const c = view.commit;
    const replay = c.replayed ? ' · idempotent replay' : '';
    return t(locale, 'ops.import.commitLabel', { committedRowCount: c.committedRowCount, skippedRowCount: c.skippedRowCount, errorRowCount: c.errorRowCount, invitationCount: c.invitationCount, replaySuffix: replay });
  }
  if (view.kind === 'errors') {
    const name = view.filename ? ` · ${view.filename}` : '';
    return t(locale, 'ops.import.errorsDownloadLabel', { contentType: view.contentType, byteLength: view.byteLength, filenameSuffix: name });
  }
  if (view.kind === 'upload') {
    return t(locale, 'ops.import.quarantineReady', { fileId: view.file.fileId, byteLength: view.file.byteLength });
  }
  if (view.kind === 'rejected') {
    return t(locale, 'ops.export.apiRejected', { code: view.code, message: view.message });
  }
  return view.message;
}
