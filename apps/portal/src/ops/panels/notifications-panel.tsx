'use client';

import { Alert, Button, Space, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import { bffNotifications } from '../../prep/bff-urls';
import {
  interpretNotificationList,
  interpretNotificationRetry,
  notificationListLabel,
  notificationRetryLabel,
  providerStatusLabel,
  type NotificationListView,
} from '../notifications';

type Props = {
  tenantId: string;
  eventId: string;
  canNotify: boolean;
};

export function NotificationsOpsPanel({
  tenantId,
  eventId,
  canNotify,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<NotificationListView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const result = await portalGet(
      `${bffNotifications(tenantId, eventId)}?limit=50`,
    );
    const next = interpretNotificationList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setView(next);
    setNotice(notificationListLabel(next));
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

  async function retry(notificationId: string) {
    if (!canNotify) return;
    setBusy(true);
    const result = await portalMutate(
      `${bffNotifications(tenantId, eventId)}/${encodeURIComponent(notificationId)}/retry`,
      { reason: 'portal retry', idempotencyKey: crypto.randomUUID() },
    );
    const next = interpretNotificationRetry(
      result.status,
      result.json,
      result.networkError || result.timedOut,
    );
    setNotice(notificationRetryLabel(next));
    if (next.kind === 'requeued') void load();
    else setBusy(false);
  }

  const items = view?.kind === 'list' ? view.items : [];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="ACCEPTED ≠ DELIVERED"
        description="ACCEPTED chỉ nghĩa nhà cung cấp đã nhận — không chứng minh đã giao tới người nhận. Không map ACCEPTED thành «đã giao»."
      />
      <Button loading={busy} onClick={() => void load()}>
        Làm mới
      </Button>
      {view?.kind === 'unknown' || view?.kind === 'rejected' ? (
        <Alert type="warning" showIcon message={notificationListLabel(view)} />
      ) : null}
      <Table
        size="small"
        loading={busy}
        rowKey="notificationId"
        dataSource={items}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'notificationId', ellipsis: true },
          { title: 'Channel', dataIndex: 'channel', width: 100 },
          {
            title: 'Provider status',
            dataIndex: 'providerStatus',
            render: (status: string) =>
              providerStatusLabel(
                status as Parameters<typeof providerStatusLabel>[0],
              ),
          },
          { title: 'Kind', dataIndex: 'kind', ellipsis: true },
          {
            title: 'Thao tác',
            key: 'actions',
            render: (_, row) =>
              canNotify &&
              (row.providerStatus === 'FAILED' ||
                row.providerStatus === 'DEAD') ? (
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => void retry(row.notificationId)}
                >
                  Retry
                </Button>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
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
