'use client';

import { useCallback, useState } from 'react';
import {
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
  type ExportView,
} from './export-job';
import type { AdminScope } from './scope';
import { useIdempotentAction } from './use-idempotent-action';
import { fetchJson } from '../redeem/fetch-json';
import { REQUEST_TIMEOUT_MS } from '../redeem/poll-operation';

type Params = {
  scope: () => AdminScope;
  onBusy: (busy: boolean) => void;
  onBumpNotice: () => void;
  onClearSiblingViews: () => void;
};

export function useExportApi({
  scope,
  onBusy,
  onBumpNotice,
  onClearSiblingViews,
}: Params) {
  const exportIdempotency = useIdempotentAction();
  const [exportId, setExportId] = useState('');
  const [exportView, setExportView] = useState<ExportView | null>(null);

  const clearViews = useCallback(() => {
    setExportView(null);
  }, []);

  const createExport = useCallback(async () => {
    const fingerprint = JSON.stringify({ ...scope(), format: 'csv' });
    const idempotencyKey = exportIdempotency.keyFor(fingerprint);
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const result = await fetchJson(
      '/api/bff/admin/exports',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scope(),
          format: 'csv',
          idempotencyKey,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    const next = interpretExportCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    exportIdempotency.remember(
      idempotencyKey,
      fingerprint,
      next.kind === 'unknown',
    );
    if (next.kind === 'created') setExportId(next.job.exportId);
    onBumpNotice();
    setExportView(next);
    onBusy(false);
  }, [
    clearViews,
    exportIdempotency,
    onBumpNotice,
    onBusy,
    onClearSiblingViews,
    scope,
  ]);

  const loadExportStatus = useCallback(async () => {
    const id = exportId.trim();
    if (!id) {
      setExportView({
        kind: 'rejected',
        code: 'EXPORT_ID_REQUIRED',
        message: 'exportId must be a UUID.',
      });
      return;
    }
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const params = new URLSearchParams(scope());
    const result = await fetchJson(
      `/api/bff/admin/exports/${encodeURIComponent(id)}?${params.toString()}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
    );
    onBumpNotice();
    setExportView(
      interpretExportStatus(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        id,
      ),
    );
    onBusy(false);
  }, [clearViews, exportId, onBumpNotice, onBusy, onClearSiblingViews, scope]);

  const downloadExport = useCallback(async () => {
    const id = exportId.trim();
    if (!id) {
      setExportView({
        kind: 'rejected',
        code: 'EXPORT_ID_REQUIRED',
        message: 'exportId must be a UUID.',
      });
      return;
    }
    onBusy(true);
    onClearSiblingViews();
    clearViews();
    const params = new URLSearchParams(scope());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(
        `/api/bff/admin/exports/${encodeURIComponent(id)}/download?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      const contentType = response.headers.get('Content-Type');
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      if ((contentType ?? '').includes('application/json')) {
        const json = (await response.json()) as unknown;
        onBumpNotice();
        setExportView(
          interpretExportDownload(
            response.status,
            json,
            false,
            id,
            contentType,
          ),
        );
      } else {
        const buf = await response.arrayBuffer();
        const filename = filenameMatch?.[1] ?? `export-${id}.csv`;
        const view = interpretExportDownload(
          response.status,
          null,
          false,
          id,
          contentType,
          buf.byteLength,
          filenameMatch?.[1] ?? null,
        );
        if (view.kind === 'download') {
          const blob = new Blob([buf], {
            type: contentType ?? 'text/csv',
          });
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = filename;
          anchor.rel = 'noopener';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(objectUrl);
        }
        onBumpNotice();
        setExportView(view);
      }
    } catch {
      onBumpNotice();
      setExportView(interpretExportDownload(0, null, true, id, null));
    } finally {
      clearTimeout(timer);
      onBusy(false);
    }
  }, [clearViews, exportId, onBumpNotice, onBusy, onClearSiblingViews, scope]);

  return {
    exportId,
    setExportId,
    exportView,
    clearViews,
    createExport,
    loadExportStatus,
    downloadExport,
  };
}
