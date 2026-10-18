'use client';

import { Alert, Button, Input, Select, Space, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  portalDownload,
  portalGet,
  portalMutate,
} from '../../client/portal-fetch';
import { bffExports } from '../../prep/bff-urls';
import {
  exportAlertType,
  exportHistoryLabel,
  exportViewLabel,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportHistory,
  interpretExportStatus,
  type ExportHistoryItem,
  type ExportHistoryView,
  type ExportView,
} from '../export-job';

type Props = {
  tenantId: string;
  eventId: string;
  canCreate: boolean;
  canDownload: boolean;
};

const STATUS_OPTIONS: {
  value: ExportHistoryItem['status'];
  label: string;
}[] = [
  { value: 'PENDING', label: 'PENDING' },
  { value: 'PROCESSING', label: 'PROCESSING' },
  { value: 'READY', label: 'READY' },
  { value: 'FAILED', label: 'FAILED' },
];

export function ExportPanel({
  tenantId,
  eventId,
  canCreate,
  canDownload,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [exportId, setExportId] = useState('');
  const [view, setView] = useState<ExportView | null>(null);
  const [historyView, setHistoryView] = useState<ExportHistoryView | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<
    ExportHistoryItem['status'] | undefined
  >();
  const [notice, setNotice] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('limit', '20');
    if (statusFilter) params.set('status', statusFilter);
    const result = await portalGet(
      `${bffExports(tenantId, eventId)}?${params.toString()}`,
    );
    const next = interpretExportHistory(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setHistoryView(next);
    if (next.kind !== 'list') {
      setNotice(exportHistoryLabel(next));
    }
  }, [tenantId, eventId, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadHistory();
    });
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  async function createExport() {
    if (!canCreate) {
      setNotice('Cần export.create từ máy chủ.');
      return;
    }
    setBusy(true);
    const result = await portalMutate(bffExports(tenantId, eventId), {
      idempotencyKey: crypto.randomUUID(),
    });
    const next = interpretExportCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setNotice(exportViewLabel(next));
    if (next.kind === 'created') {
      setExportId(next.job.exportId);
      void loadHistory();
    }
    setBusy(false);
  }

  async function checkStatus() {
    const id = exportId.trim();
    if (!id) return;
    setBusy(true);
    const result = await portalGet(
      `${bffExports(tenantId, eventId)}/${encodeURIComponent(id)}`,
    );
    const next = interpretExportStatus(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      id,
    );
    setView(next);
    setNotice(exportViewLabel(next));
    setBusy(false);
  }

  async function download() {
    if (!canDownload) {
      setNotice('Cần export.download từ máy chủ.');
      return;
    }
    const id = exportId.trim();
    if (!id) return;
    setBusy(true);
    const res = await portalDownload(
      `${bffExports(tenantId, eventId)}/${encodeURIComponent(id)}/download`,
    );
    if (res.status === 200 && res.blob) {
      const filename =
        /filename="?([^"]+)"?/i.exec(res.contentDisposition ?? '')?.[1] ??
        `export-${id}.csv`;
      const next = interpretExportDownload(
        res.status,
        null,
        false,
        id,
        res.contentType,
        res.blob.size,
        filename,
      );
      setView(next);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(exportViewLabel(next));
    } else {
      const next = interpretExportDownload(
        res.status,
        null,
        res.networkError || res.timedOut,
        id,
        res.contentType,
      );
      setView(next);
      setNotice(exportViewLabel(next));
    }
    setBusy(false);
  }

  const history = historyView?.kind === 'list' ? historyView.items : [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Export CSV / recovery · G-E1 history filter"
        description="Tạo job → poll status → tải stream authenticated khi READY. List không chứa object key hay URL ký sẵn. unknown ≠ success."
      />
      <Space wrap role="search" aria-label="Bộ lọc lịch sử export">
        <Select
          allowClear
          placeholder="Status history"
          style={{ minWidth: 160 }}
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setStatusFilter(v)}
          aria-label="Lọc lịch sử theo status"
        />
        <Button
          type="primary"
          loading={busy}
          onClick={() => void loadHistory()}
          aria-label="Áp dụng bộ lọc lịch sử export"
        >
          Lọc lịch sử
        </Button>
        {canCreate ? (
          <Button
            type="primary"
            loading={busy}
            onClick={() => void createExport()}
          >
            Tạo export
          </Button>
        ) : (
          <Typography.Text type="secondary">Cần export.create</Typography.Text>
        )}
        <Input
          placeholder="exportId"
          value={exportId}
          onChange={(e) => setExportId(e.target.value)}
          style={{ minWidth: 280 }}
          spellCheck={false}
          aria-label="exportId"
        />
        <Button
          loading={busy}
          disabled={!exportId.trim()}
          onClick={() => void checkStatus()}
        >
          Trạng thái
        </Button>
        <Button
          loading={busy}
          disabled={!exportId.trim() || !canDownload}
          onClick={() => void download()}
        >
          Tải CSV
        </Button>
      </Space>
      {historyView && historyView.kind !== 'list' ? (
        <Alert
          type={exportAlertType(historyView)}
          showIcon
          message={exportHistoryLabel(historyView)}
          role="status"
        />
      ) : null}
      {view ? (
        <Alert
          type={exportAlertType(view)}
          showIcon
          message={exportViewLabel(view)}
          data-testid="export-result"
          role="status"
        />
      ) : null}
      <Table
        size="small"
        rowKey="exportId"
        dataSource={history}
        pagination={false}
        locale={{ emptyText: 'Chưa có lịch sử export (hoặc list lỗi).' }}
        columns={[
          { title: 'Export ID', dataIndex: 'exportId', ellipsis: true },
          { title: 'Status', dataIndex: 'status', width: 120 },
          { title: 'Created', dataIndex: 'createdAt', ellipsis: true },
          {
            title: '',
            key: 'use',
            render: (_, row) => (
              <Button size="small" onClick={() => setExportId(row.exportId)}>
                Chọn
              </Button>
            ),
          },
        ]}
      />
      {notice ? (
        <Typography.Text type="secondary">{notice}</Typography.Text>
      ) : null}
    </Space>
  );
}
