'use client';

import { Alert, Button, Input, Space, Table, Typography } from 'antd';
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

type Props = {
  tenantId: string;
  eventId: string;
  canApprove: boolean;
};

export function PendingPanel({ tenantId, eventId, canApprove }: Props) {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PendingView | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const result = await portalGet(
      `${bffRedemptions(tenantId, eventId)}?status=PENDING_REVIEW&limit=50`,
    );
    const next = interpretPendingList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setNotice(pendingListLabel(next));
    setBusy(false);
  }, [tenantId, eventId]);

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

  const items: PendingItem[] =
    view?.kind === 'list' ? view.items : [];

  return (
    <div id="pending">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="G-R2 — danh sách chờ duyệt qua BFF GET /redemptions"
          description="Không suy email/phone từ requestId. Approve/deny idempotent."
        />
        <Space>
          <Button loading={busy} onClick={() => void load()}>
            Làm mới
          </Button>
          <Input
            placeholder="Lý do từ chối (bắt buộc khi Deny)"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            style={{ minWidth: 280 }}
            maxLength={500}
          />
        </Space>
        {view?.kind === 'unknown' || view?.kind === 'rejected' ? (
          <Alert
            type="warning"
            showIcon
            message={pendingListLabel(view)}
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
