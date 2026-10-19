import {
  apiErrorFrom,
  asRecord,
  isExportStatus,
  isNonEmptyString,
  optionalNumber,
  optionalString,
} from './contract-shape';
import { t } from '../i18n/t';
import { DEFAULT_PORTAL_LOCALE, type PortalLocale } from '../i18n/locale';

type EventScope = { tenantId: string; eventId: string };

function eventExportsBase(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/exports`;
}

export function exportsCreatePath(scope: EventScope): string {
  return eventExportsBase(scope);
}

/** G-E1 — history list; optional status filter. Never returns object keys/URLs. */
export function exportsListPath(
  scope: EventScope,
  query?: {
    cursor?: string;
    limit?: number;
    status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  },
): string {
  const base = eventExportsBase(scope);
  const params = new URLSearchParams();
  if (query?.cursor) params.set('cursor', query.cursor);
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  if (query?.status) params.set('status', query.status);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function exportStatusPath(scope: EventScope, exportId: string): string {
  return `${eventExportsBase(scope)}/${encodeURIComponent(exportId)}`;
}

export function exportDownloadPath(scope: EventScope, exportId: string): string {
  return `${eventExportsBase(scope)}/${encodeURIComponent(exportId)}/download`;
}

export type ExportJobFields = {
  exportId: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  rowCount: number | null;
  expiresAt: string | null;
  error: string | null;
  replayed: boolean | null;
};

export type ExportHistoryItem = {
  exportId: string;
  status: ExportJobFields['status'];
  createdAt: string | null;
  rowCount: number | null;
};

export type ExportHistoryView =
  | { kind: 'list'; items: ExportHistoryItem[]; nextCursor: string | null }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export type ExportView =
  | { kind: 'created'; job: ExportJobFields }
  | { kind: 'status'; job: ExportJobFields }
  | {
      kind: 'download';
      exportId: string;
      contentType: string;
      byteLength: number;
      filename: string | null;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const EXPORT_UNKNOWN =
  t(DEFAULT_PORTAL_LOCALE, 'ops.export.unknown');

function parseExportJob(json: unknown): ExportJobFields | null {
  const body = asRecord(json);
  if (!body) return null;
  if (!isNonEmptyString(body.exportId) || !isExportStatus(body.status)) {
    return null;
  }
  // Reject legacy `id` success without exportId (already covered) and owner raw fields.
  if ('ownerEmail' in body || 'ownerUserId' in body) {
    return null;
  }
  if (body.rowCount !== null && typeof body.rowCount !== 'number') return null;
  if (body.expiresAt !== null && typeof body.expiresAt !== 'string') return null;
  if (body.error !== null && typeof body.error !== 'string') return null;
  return {
    exportId: body.exportId.trim(),
    status: body.status,
    rowCount: optionalNumber(body.rowCount),
    expiresAt: optionalString(body.expiresAt),
    error: optionalString(body.error),
    replayed: typeof body.replayed === 'boolean' ? body.replayed : null,
  };
}

export function interpretExportCreate(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  if (status === 200 || status === 201) {
    const job = parseExportJob(json);
    if (job) return { kind: 'created', job };
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
}

export function interpretExportStatus(
  status: number,
  json: unknown,
  networkError: boolean,
  exportId: string,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ExportView {
  void exportId;
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  if (status === 200) {
    const job = parseExportJob(json);
    if (job) return { kind: 'status', job };
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
}

/**
 * Download is streamed CSV (text/csv) with Cache-Control: private, no-store.
 * JSON error bodies use the ApiError shape. Guessed downloadUrl/href is not success.
 */
export function interpretExportDownload(
  status: number,
  json: unknown,
  networkError: boolean,
  exportId: string,
  contentType: string | null,
  byteLength = 0,
  filename: string | null = null,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  const body = asRecord(json);
  if (status === 200) {
    const ct = (contentType ?? '').toLowerCase();
    if (ct.includes('text/csv') || ct.includes('application/octet-stream')) {
      return {
        kind: 'download',
        exportId,
        contentType: contentType ?? 'text/csv',
        byteLength,
        filename,
      };
    }
    // Fail closed: JSON with url/downloadUrl is not the contract.
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
}

export function interpretExportHistory(
  status: number,
  json: unknown,
  networkError: boolean,
  locale: PortalLocale = DEFAULT_PORTAL_LOCALE,
): ExportHistoryView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
    }
    const items: ExportHistoryItem[] = [];
    for (const raw of body.items) {
      const row = asRecord(raw);
      if (!row || !isNonEmptyString(row.exportId) || !isExportStatus(row.status)) {
        return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
      }
      // Fail closed: object keys / presigned URLs are never success fields.
      if ('downloadUrl' in row || 'objectKey' in row || 'url' in row) {
        return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
      }
      items.push({
        exportId: row.exportId.trim(),
        status: row.status,
        createdAt: optionalString(row.createdAt),
        rowCount: optionalNumber(row.rowCount),
      });
    }
    const nextCursor =
      typeof body.nextCursor === 'string' && body.nextCursor.trim()
        ? body.nextCursor.trim()
        : null;
    return { kind: 'list', items, nextCursor };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: t(locale, 'ops.export.unknown') };
}

export function exportHistoryLabel(view: ExportHistoryView, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (view.kind === 'list') {
    return t(locale, 'ops.export.historyLabel', { count: view.items.length, pageSuffix: view.nextCursor ? t(locale, 'common.pagination.pageSuffix') : '' });
  }
  if (view.kind === 'rejected') {
    return t(locale, 'ops.export.apiRejected', { code: view.code, message: view.message });
  }
  return view.message;
}

/** Alert tone — unknown/rejected must never render as success. */
export function exportAlertType(
  view: ExportView | ExportHistoryView,
): 'success' | 'warning' | 'error' {
  if (view.kind === 'rejected') return 'error';
  if (view.kind === 'unknown') return 'warning';
  return 'success';
}

export function exportViewLabel(view: ExportView, locale: PortalLocale = DEFAULT_PORTAL_LOCALE): string {
  if (view.kind === 'created' || view.kind === 'status') {
    const { job } = view;
    const expires = job.expiresAt ? t(locale, 'ops.export.expiresSuffix', { expiresAt: job.expiresAt }) : '';
    const rows =
      job.rowCount === null ? '' : t(locale, 'ops.export.rowsSuffix', { rowCount: job.rowCount });
    return t(locale, 'ops.export.jobLabel', { exportId: job.exportId, status: job.status, rowsSuffix: rows, expiresSuffix: expires });
  }
  if (view.kind === 'download') {
    const name = view.filename ? ` · ${view.filename}` : '';
    return t(locale, 'ops.export.downloadLabel', { exportId: view.exportId, contentType: view.contentType, byteLength: view.byteLength, filenameSuffix: name });
  }
  if (view.kind === 'rejected') {
    return t(locale, 'ops.export.apiRejected', { code: view.code, message: view.message });
  }
  return view.message;
}
