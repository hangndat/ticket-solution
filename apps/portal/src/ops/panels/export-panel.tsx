'use client';

import { Alert, Button, Input, Select, Space, Table, Typography } from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../../client/use-actor-state';
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
import { usePortalLocale } from '../../i18n';
import { SavedViewsToolbar } from '../../views';
import { useMutationIntent } from '../../client/use-mutation-intent';
import { MutationIntentAlert } from '../../client/mutation-intent-alert';

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

const TICKET_STATE_OPTIONS = ['ACTIVE', 'REVOKED', 'CANCELLED', 'USED'].map((value) => ({ value, label: value }));

export function ExportPanel({
  tenantId,
  eventId,
  canCreate,
  canDownload,
}: Props) {
  const { t, locale } = usePortalLocale();
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
  const [ticketStates, setTicketStates] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const intent = useMutationIntent(tenantId, eventId, 'create-export');

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
      locale,
    );
    setHistoryView(next);
    if (next.kind !== 'list') {
      setNotice(exportHistoryLabel(next, locale));
    }
  }, [tenantId, eventId, statusFilter, locale]);

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
      setNotice(t('ops.export.needCreateServer'));
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      setNotice(t('ops.export.invalidRange'));
      return;
    }
    const filter = {
      ...(ticketStates.length ? { states: ticketStates } : {}),
      ...(fromDate ? { from: `${fromDate}T00:00:00.000Z` } : {}),
      ...(toDate ? { to: `${toDate}T23:59:59.999Z` } : {}),
    };
    setBusy(true);
    const outcome = await intent.run({ format: 'csv', filter },
      (body) => portalMutate(bffExports(tenantId, eventId), body),
      (response) => interpretExportCreate(response.status, response.json,
        response.networkError || response.timedOut, locale).kind === 'created');
    if (outcome.kind === 'blocked') {
      setNotice('Lần tạo export trước chưa rõ kết quả. Kiểm tra lịch sử export trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const result = outcome.response;
    const next = interpretExportCreate(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setView(next);
    setNotice(exportViewLabel(next, locale));
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
      locale,
    );
    setView(next);
    setNotice(exportViewLabel(next, locale));
    setBusy(false);
  }

  async function download() {
    if (!canDownload) {
      setNotice(t('ops.export.needDownloadServer'));
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
        locale,
      );
      setView(next);
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setNotice(exportViewLabel(next, locale));
    } else {
      const next = interpretExportDownload(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        id,
        res.contentType,
        undefined,
        undefined,
        locale,
      );
      setView(next);
      setNotice(exportViewLabel(next, locale));
    }
    setBusy(false);
  }

  const history = historyView?.kind === 'list' ? historyView.items : [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={t('ops.export.panelInfo')}
        description={t('ops.export.panelDescription')}
      />
      <SavedViewsToolbar
        tenantId={tenantId}
        eventId={eventId}
        surface="exports"
        filters={{ status: statusFilter }}
        onApply={(next) => {
          setStatusFilter(
            next.filters.status as ExportHistoryItem['status'] | undefined,
          );
        }}
      />
      {canCreate ? (
        <Space wrap role="group" aria-label={t('ops.export.ticketFilters')}>
          <Select mode="multiple" allowClear value={ticketStates} onChange={setTicketStates}
            options={TICKET_STATE_OPTIONS} placeholder={t('ops.export.ticketStates')}
            style={{ minWidth: 220 }} aria-label={t('ops.export.ticketStates')} />
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            aria-label={t('ops.export.fromUtc')} style={{ minWidth: 170 }} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            aria-label={t('ops.export.toUtc')} style={{ minWidth: 170 }} />
          <Typography.Text type="secondary">{t('ops.export.dateUtcHint')}</Typography.Text>
        </Space>
      ) : null}
      <Space wrap role="search" aria-label={t('ops.export.filterHistoryAria')}>
        <Select
          allowClear
          placeholder="Status history"
          style={{ minWidth: 160 }}
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(v) => setStatusFilter(v)}
          aria-label={t('ops.export.filterStatusAria')}
        />
        <Button
          type="primary"
          loading={busy}
          onClick={() => void loadHistory()}
          aria-label={t('ops.export.filterHistoryApply')}
        >
          {t('ops.h_1wgnyat')}
        </Button>
        {canCreate ? (
          <Button
            type="primary"
            loading={busy}
            onClick={() => void createExport()}
          >
            {t('ops.export.createButton')}
          </Button>
        ) : (
          <Typography.Text type="secondary">
            {t('ops.export.needCreate')}
          </Typography.Text>
        )}
        <Input
          placeholder={t('ops.export.exportIdPlaceholder')}
          value={exportId}
          onChange={(e) => setExportId(e.target.value)}
          style={{ minWidth: 280 }}
          spellCheck={false}
          aria-label={t('ops.export.exportIdAria')}
          data-testid="export-id-input"
        />
        <Button
          loading={busy}
          disabled={!exportId.trim()}
          onClick={() => void checkStatus()}
        >
          {t('ops.export.statusButton')}
        </Button>
        <Button
          loading={busy}
          disabled={!exportId.trim() || !canDownload}
          onClick={() => void download()}
        >
          {t('ops.h_bitcvf')}
        </Button>
      </Space>
      {historyView && historyView.kind !== 'list' ? (
        <Alert
          type={exportAlertType(historyView)}
          showIcon
          message={exportHistoryLabel(historyView, locale)}
          role="status"
        />
      ) : null}
      {view ? (
        <Alert
          type={exportAlertType(view)}
          showIcon
          message={exportViewLabel(view, locale)}
          data-testid="export-result"
          role="status"
        />
      ) : null}
      {view?.kind === 'rejected' && view.code === 'EXPORT_EXPIRED' && canCreate ? (
        <Space wrap>
          <Typography.Text>{t('ops.export.expiredRecovery')}</Typography.Text>
          <Button type="primary" loading={busy} onClick={() => void createExport()}>
            {t('ops.export.createAgain')}
          </Button>
        </Space>
      ) : null}
      <MutationIntentAlert pending={intent.pending} needsReconciliation={intent.needsReconciliation}
        onCheck={() => void loadHistory()} onStartNew={intent.release} />
      <Table
        size="small"
        rowKey="exportId"
        dataSource={history}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: t('ops.export.historyEmpty') }}
        columns={[
          {
            title: t('ops.table.exportId'),
            dataIndex: 'exportId',
            ellipsis: true,
          },
          { title: t('ops.table.status'), dataIndex: 'status', width: 120 },
          {
            title: t('ops.table.created'),
            dataIndex: 'createdAt',
            ellipsis: true,
          },
          {
            title: '',
            key: 'use',
            render: (_, row) => (
              <Button size="small" onClick={() => setExportId(row.exportId)}>
                {t('common.select')}
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
