type EventScope = { tenantId: string; eventId: string };

function eventExportsBase(scope: EventScope): string {
  return `/v1/tenants/${encodeURIComponent(scope.tenantId)}/events/${encodeURIComponent(scope.eventId)}/exports`;
}

/** Upstream paths from the approved export contract (exact response types still pending). */
export function exportsCreatePath(scope: EventScope): string {
  return eventExportsBase(scope);
}

export function exportStatusPath(scope: EventScope, exportId: string): string {
  return `${eventExportsBase(scope)}/${encodeURIComponent(exportId)}`;
}

export function exportDownloadPath(scope: EventScope, exportId: string): string {
  return `${eventExportsBase(scope)}/${encodeURIComponent(exportId)}/download`;
}

export type ExportView =
  | { kind: 'created'; exportId: string; status: string | null; raw: unknown }
  | { kind: 'status'; exportId: string; status: string | null; raw: unknown }
  | {
      kind: 'download';
      exportId: string;
      href: string | null;
      contentType: string | null;
      raw: unknown;
    }
  | { kind: 'rejected'; code: string; message: string }
  | { kind: 'unknown'; message: string };

export const EXPORT_UNKNOWN =
  'Kết quả export chưa biết. Không coi là đã tạo hoặc đã tải xong.';

function record(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  return json as Record<string, unknown>;
}

function exportIdFrom(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  for (const key of ['exportId', 'id'] as const) {
    if (typeof body[key] === 'string' && body[key].trim()) {
      return (body[key] as string).trim();
    }
  }
  return null;
}

function statusFrom(body: Record<string, unknown> | null): string | null {
  if (!body) return null;
  return typeof body.status === 'string' ? body.status : null;
}

export function interpretExportCreate(
  status: number,
  json: unknown,
  networkError: boolean,
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 || status === 201 || status === 202) {
    const exportId = exportIdFrom(body);
    if (exportId) {
      return {
        kind: 'created',
        exportId,
        status: statusFrom(body),
        raw: json,
      };
    }
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function interpretExportStatus(
  status: number,
  json: unknown,
  networkError: boolean,
  exportId: string,
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 && body) {
    return {
      kind: 'status',
      exportId,
      status: statusFrom(body),
      raw: json,
    };
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function interpretExportDownload(
  status: number,
  json: unknown,
  networkError: boolean,
  exportId: string,
  contentType: string | null,
): ExportView {
  if (networkError || status === 0 || status >= 500) {
    return { kind: 'unknown', message: EXPORT_UNKNOWN };
  }
  const body = record(json);
  if (status === 200 || status === 302) {
    const href =
      typeof body?.url === 'string'
        ? body.url
        : typeof body?.downloadUrl === 'string'
          ? body.downloadUrl
          : typeof body?.href === 'string'
            ? body.href
            : null;
    return {
      kind: 'download',
      exportId,
      href,
      contentType,
      raw: json,
    };
  }
  if (body && typeof body.code === 'string') {
    return {
      kind: 'rejected',
      code: body.code,
      message: typeof body.message === 'string' ? body.message : body.code,
    };
  }
  return { kind: 'unknown', message: EXPORT_UNKNOWN };
}

export function exportViewLabel(view: ExportView): string {
  if (view.kind === 'created') {
    return `Export ${view.exportId} đã tạo${view.status ? ` (${view.status})` : ''}. Link tải có hạn; không tự tải khi chưa sẵn sàng.`;
  }
  if (view.kind === 'status') {
    return `Export ${view.exportId}: ${view.status ?? 'trạng thái chưa rõ'}.`;
  }
  if (view.kind === 'download') {
    if (view.href) {
      return `Export ${view.exportId}: có URL tải có hạn (không lưu URL dài hạn trên UI).`;
    }
    return `Export ${view.exportId}: phản hồi tải ${view.contentType ?? 'binary'} — kiểm tra header Content-Type.`;
  }
  if (view.kind === 'rejected') {
    return `${view.code}: ${view.message}`;
  }
  return view.message;
}
