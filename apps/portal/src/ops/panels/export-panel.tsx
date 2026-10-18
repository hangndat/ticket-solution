'use client';

import { Alert, Button, Input, Space, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  portalDownload,
  portalGet,
  portalMutate,
} from '../../client/portal-fetch';
import { bffExports } from '../../prep/bff-urls';
import {
  exportViewLabel,
  interpretExportCreate,
  interpretExportDownload,
  interpretExportStatus,
  type ExportView,
} from '../export-job';
import { asRecord } from '../contract-shape';

type Props = {
  tenantId: string;
  eventId: string;
};

type HistoryRow = {
  key: string;
  exportId: string;
  status: string;
  createdAt?: string;
};

export function ExportPanel({ tenantId, eventId }: Props) {
  const [busy, setBusy] = useState(false);
  const [exportId, setExportId] = useState('');
  const [view, setView] = useState<ExportView | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const result = await portalGet(
      `${bffExports(tenantId, eventId)}?limit=20`,
    );
    if (result.status !== 200 || result.networkError) {
      setHistory([]);
      return;
    }
    const body = asRecord(result.json);
    const items = Array.isArray(body?.items) ? body!.items : [];
    const rows: HistoryRow[] = [];
    for (const raw of items) {
      const row = asRecord(raw);
      if (!row || typeof row.exportId !== 'string') continue;
      // Fail closed: never treat object keys / presigned URLs as success fields.
      if ('downloadUrl' in row || 'objectKey' in row || 'url' in row) continue;
      rows.push({
        key: row.exportId,
        exportId: row.exportId,
        status: typeof row.status === 'string' ? row.status : '?',
        createdAt:
          typeof row.createdAt === 'string' ? row.createdAt : undefined,
      });
    }
    setHistory(rows);
  }, [tenantId, eventId]);

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

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Export CSV / recovery"
        description="Tạo job → poll status → tải stream authenticated khi READY. List không chứa object key hay URL ký sẵn."
      />
      <Space wrap>
        <Button type="primary" loading={busy} onClick={() => void createExport()}>
          Tạo export
        </Button>
        <Input
          placeholder="exportId"
          value={exportId}
          onChange={(e) => setExportId(e.target.value)}
          style={{ minWidth: 280 }}
          spellCheck={false}
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
          disabled={!exportId.trim()}
          onClick={() => void download()}
        >
          Tải CSV
        </Button>
        <Button loading={busy} onClick={() => void loadHistory()}>
          Lịch sử
        </Button>
      </Space>
      {view ? (
        <Alert
          type={view.kind === 'rejected' ? 'error' : 'success'}
          showIcon
          message={exportViewLabel(view)}
          data-testid="export-result"
        />
      ) : null}
      <Table
        size="small"
        rowKey="key"
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
              <Button
                size="small"
                onClick={() => setExportId(row.exportId)}
              >
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
