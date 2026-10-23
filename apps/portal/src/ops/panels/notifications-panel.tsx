'use client';

import { Alert, Button, Select, Space, Table, Typography } from 'antd';
import type { NotificationChannel, NotificationProviderStatus } from '@ticket/contracts';
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
import { usePortalLocale, type MessageKey } from '../../i18n';
import { SavedViewsToolbar } from '../../views';
import { NotificationsTemplatesSection } from './notifications-templates-section';

type Props = {
  tenantId: string;
  eventId: string;
  canNotify: boolean;
};

function buildStateOptions(
  translate: (key: MessageKey) => string,
): { value: NotificationProviderStatus; label: string }[] {
  return [
    { value: 'PENDING', label: 'PENDING' },
    { value: 'ACCEPTED', label: translate('notify.acceptedNotDelivered') },
    { value: 'FAILED', label: 'FAILED' },
    { value: 'DEAD', label: 'DEAD' },
    { value: 'UNKNOWN', label: 'UNKNOWN' },
  ];
}

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'email', label: 'email' },
  { value: 'push', label: 'push' },
];

export function NotificationsOpsPanel({
  tenantId,
  eventId,
  canNotify,
}: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const setPanelBusy = useCallback((next: boolean) => setBusy(next), []);
  const [view, setView] = useState<NotificationListView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<NotificationProviderStatus | undefined>();
  const [channel, setChannel] = useState<NotificationChannel | undefined>();

  const load = useCallback(async () => {
    setBusy(true);
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (state) params.set('state', state);
    if (channel) params.set('channel', channel);
    const result = await portalGet(
      `${bffNotifications(tenantId, eventId)}?${params.toString()}`,
    );
    const next = interpretNotificationList(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    setView(next);
    setNotice(notificationListLabel(next, locale));
    setBusy(false);
  }, [tenantId, eventId, state, channel, locale]);

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
      result.networkError || result.timedOut, locale,
    );
    setNotice(notificationRetryLabel(next, locale));
    if (next.kind === 'requeued') void load();
    else setBusy(false);
  }

  const items = view?.kind === 'list' ? view.items : [];
  const alertType =
    view?.kind === 'rejected'
      ? 'error'
      : view?.kind === 'unknown'
        ? 'warning'
        : undefined;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message={t('notify.acceptedDelimitedFilters')}
        description={t('notify.acceptedLegend')}
      />
      <SavedViewsToolbar
        tenantId={tenantId}
        eventId={eventId}
        surface="notifications"
        filters={{ state, channel }}
        onApply={(next) => {
          setState(
            next.filters.state as NotificationProviderStatus | undefined,
          );
          setChannel(next.filters.channel as NotificationChannel | undefined);
        }}
      />
      <Space wrap role="search" aria-label={t('ops.notifications.filtersTitle')}>
        <Select
          allowClear
          placeholder="Provider state"
          style={{ minWidth: 220 }}
          value={state}
          options={buildStateOptions(t)}
          onChange={(v) => setState(v)}
          aria-label={t('ops.h_70gxgv')}
        />
        <Select
          allowClear
          placeholder="Channel"
          style={{ minWidth: 140 }}
          value={channel}
          options={CHANNEL_OPTIONS}
          onChange={(v) => setChannel(v)}
          aria-label={t('ops.h_1je2q3y')}
        />
        <Button
          type="primary"
          loading={busy}
          onClick={() => void load()}
          aria-label={t('ops.notifications.applyFilters')}
        >{t('platform.loc')}</Button>
        <Button loading={busy} onClick={() => void load()}>{t('gate.h_3keb7')}</Button>
      </Space>
      {alertType ? (
        <Alert
          type={alertType}
          showIcon
          message={notificationListLabel(view!, locale)}
          role="status"
        />
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
                status as Parameters<typeof providerStatusLabel>[0], locale,
              ),
          },
          { title: 'Kind', dataIndex: 'kind', ellipsis: true },
          {
            title: t('ops.h_1pbxt75'),
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
      <NotificationsTemplatesSection
        tenantId={tenantId}
        eventId={eventId}
        canNotify={canNotify}
        busy={busy}
        onBusy={setPanelBusy}
      />
    </Space>
  );
}
