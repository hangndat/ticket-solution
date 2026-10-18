'use client';

import { Alert, Button, Input, Select, Space, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import { bffRedemptions } from '../../prep/bff-urls';
import { decideAdmin, adminDecisionLabel } from '../decide';
import {
  interpretPendingList,
  pendingListLabel,
  type PendingItem,
  type PendingView,
} from '../pending';

type CatalogItem = { id: string; label: string };

type Props = {
  tenantId: string;
  eventId: string;
  canApprove: boolean;
  sources?: CatalogItem[];
  ticketTypes?: CatalogItem[];
};

function buildBffQuery(opts: {
  sourceId?: string;
  ticketTypeId?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set('status', 'PENDING_REVIEW');
  params.set('limit', '50');
  if (opts.sourceId) params.set('sourceId', opts.sourceId);
  if (opts.ticketTypeId) params.set('ticketTypeId', opts.ticketTypeId);
  if (opts.q) params.set('q', opts.q);
  return params.toString();
}

export function PendingPanel({
  tenantId,
  eventId,
  canApprove,
  sources = [],
  ticketTypes = [],
}: Props) {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PendingView | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [ticketTypeId, setTicketTypeId] = useState<string | undefined>();
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const qs = buildBffQuery({
      sourceId,
      ticketTypeId,
      q: q.trim() || undefined,
    });
    const result = await portalGet(
      `${bffRedemptions(tenantId, eventId)}?${qs}`,
    );
    const next = interpretPendingList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setNotice(pendingListLabel(next));
    setBusy(false);
  }, [tenantId, eventId, sourceId, ticketTypeId, q]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function approve(requestId: string) {
    setBusy(true);
    const result = await portalMutate(
      `${bffRedemptions(tenantId, eventId)}/${encodeURIComponent(requestId)}/approve`,
      { idempotencyKey: crypto.randomUUID() },
    );
    const decision = decideAdmin(
      'approve',
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setNotice(adminDecisionLabel(decision));
    if (decision.kind === 'approved') void load();
    else setBusy(false);
  }

  async function deny(requestId: string) {
    const reason = denyReason.trim();
    if (!reason) {
      setNotice('REASON_REQUIRED: Cần lý do từ chối.');
      return;
    }
    setBusy(true);
    const result = await portalMutate(
      `${bffRedemptions(tenantId, eventId)}/${encodeURIComponent(requestId)}/deny`,
      { reason, idempotencyKey: crypto.randomUUID() },
    );
    const decision = decideAdmin(
      'deny',
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setNotice(adminDecisionLabel(decision));
    if (decision.kind === 'denied') {
      setDenyReason('');
      void load();
    } else setBusy(false);
  }

  const items: PendingItem[] = view?.kind === 'list' ? view.items : [];
  const alertType =
    view?.kind === 'rejected'
      ? 'error'
      : view?.kind === 'unknown'
        ? 'warning'
        : undefined;

  return (
    <div id="pending">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="G-R1/G-R2 — danh sách chờ duyệt + bộ lọc source/type/q"
          description="q chỉ là requestId exact (UUID). Không tìm email/phone. Approve/deny idempotent. unknown ≠ success."
        />
        <Space wrap role="search" aria-label="Bộ lọc chờ duyệt">
          <Select
            allowClear
            placeholder="Source (catalog)"
            style={{ minWidth: 200 }}
            value={sourceId}
            options={sources.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(v) => setSourceId(v)}
            aria-label="Lọc theo source"
          />
          <Select
            allowClear
            placeholder="Ticket type (catalog)"
            style={{ minWidth: 200 }}
            value={ticketTypeId}
            options={ticketTypes.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => setTicketTypeId(v)}
            aria-label="Lọc theo ticket type"
          />
          <Input
            placeholder="q = requestId (UUID exact)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 280 }}
            spellCheck={false}
            maxLength={64}
            aria-label="Lọc theo requestId exact"
          />
          <Button
            type="primary"
            loading={busy}
            onClick={() => void load()}
            aria-label="Áp dụng bộ lọc chờ duyệt"
          >
            Lọc
          </Button>
          <Button loading={busy} onClick={() => void load()}>
            Làm mới
          </Button>
          <Input
            placeholder="Lý do từ chối (bắt buộc khi Deny)"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            style={{ minWidth: 280 }}
            maxLength={500}
            aria-label="Lý do từ chối"
          />
        </Space>
        {alertType ? (
          <Alert
            type={alertType}
            showIcon
            message={pendingListLabel(view!)}
            role="status"
          />
        ) : null}
        <Table
          size="small"
          loading={busy}
          rowKey="requestId"
          dataSource={items}
          pagination={false}
          locale={{ emptyText: 'Không có yêu cầu chờ duyệt.' }}
          columns={[
            { title: 'Request', dataIndex: 'requestId', ellipsis: true },
            { title: 'Source', dataIndex: 'sourceId', ellipsis: true },
            { title: 'Type', dataIndex: 'ticketTypeId', ellipsis: true },
            { title: 'Created', dataIndex: 'createdAt', ellipsis: true },
            {
              title: 'Thao tác',
              key: 'actions',
              render: (_, row) =>
                canApprove ? (
                  <Space>
                    <Button
                      size="small"
                      type="primary"
                      disabled={busy}
                      onClick={() => void approve(row.requestId)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="small"
                      danger
                      disabled={busy}
                      onClick={() => void deny(row.requestId)}
                    >
                      Deny
                    </Button>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    Cần redemption.approve
                  </Typography.Text>
                ),
            },
          ]}
        />
        {notice ? (
          <Typography.Text type="secondary" data-testid="pending-notice">
            {notice}
          </Typography.Text>
        ) : null}
      </Space>
    </div>
  );
}
