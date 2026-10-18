import {
  apiErrorFrom,
  asRecord,
  isExportStatus,
  isNonEmptyString,
  optionalNumber,
  optionalString,
} from './contract-shape';

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
  'Kết quả export chưa biết. Không coi là đã tạo hoặc đã tải xong.';

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
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  if (status === 200 || status === 201) {
    const job = parseExportJob(json);
    if (job) return { kind: 'created', job };
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function interpretExportStatus(
  status: number,
  json: unknown,
  networkError: boolean,
  exportId: string,
): ExportView {
  void exportId;
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  if (status === 200) {
    const job = parseExportJob(json);
    if (job) return { kind: 'status', job };
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const err = apiErrorFrom(asRecord(json));
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
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
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
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
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const err = apiErrorFrom(body);
  if (err) return { kind: 'rejected', ...err };
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function interpretExportHistory(
  status: number,
  json: unknown,
  networkError: boolean,
): ExportHistoryView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  if (status === 200) {
    const body = asRecord(json);
    if (!body || !Array.isArray(body.items)) {
      return { kind: 'unknown', message: EXPORT_UNKNOWN };
    }
    const items: ExportHistoryItem[] = [];
    for (const raw of body.items) {
      const row = asRecord(raw);
      if (!row || !isNonEmptyString(row.exportId) || !isExportStatus(row.status)) {
        return { kind: 'unknown', message: EXPORT_UNKNOWN };
      }
      // Fail closed: object keys / presigned URLs are never success fields.
      if ('downloadUrl' in row || 'objectKey' in row || 'url' in row) {
        return { kind: 'unknown', message: EXPORT_UNKNOWN };
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
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function exportHistoryLabel(view: ExportHistoryView): string {
  if (view.kind === 'list') {
    return `Lịch sử export: ${view.items.length} job${view.nextCursor ? ' (còn trang)' : ''}.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
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

export function exportViewLabel(view: ExportView): string {
  if (view.kind === 'created' || view.kind === 'status') {
    const { job } = view;
    const expires = job.expiresAt ? ` · hết hạn ${job.expiresAt}` : '';
    const rows =
      job.rowCount === null ? '' : ` · ${job.rowCount} dòng`;
    return `Export ${job.exportId}: ${job.status}${rows}${expires}. Link tải có hạn; READY mới tải được.`;
  }
  if (view.kind === 'download') {
    const name = view.filename ? ` · ${view.filename}` : '';
    return `Export ${view.exportId}: đã tải CSV xuống máy (${view.contentType}, ${view.byteLength} bytes)${name}. Không lưu URL dài hạn.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
