'use client';

import { Alert, Button, Drawer, Form, Input, Space, Table, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { PortalTicketTypeSummary } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

export default function TicketTypesPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [items, setItems] = useState<PortalTicketTypeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form] = Form.useForm<{ label: string }>();

  const load = useCallback(
    async (next?: string | null) => {
      await Promise.resolve();
      setKind('loading');
      const qs = new URLSearchParams({ limit: '20' });
      if (next) qs.set('cursor', next);
      const res = await portalGet(
        `${bffEventAction(tenantId, eventId, 'ticket-types')}?${qs}`,
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setKind('unknown');
        setMessage(t('types.h_1j8nzaz'));
        return;
      }
      if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
        setKind('error');
        setMessage(apiErrorMessage(res.json, t('common.httpStatus', { status: res.status })));
        return;
      }
      const list = Array.isArray((res.json as { items?: unknown }).items)
        ? ((res.json as { items: PortalTicketTypeSummary[] }).items as PortalTicketTypeSummary[])
        : [];
      const nextCursor =
        typeof (res.json as { nextCursor?: unknown }).nextCursor === 'string'
          ? ((res.json as { nextCursor: string }).nextCursor as string)
          : null;
      setCursor(nextCursor);
      setItems(list);
      setKind(list.length === 0 ? 'empty' : 'ready');
    },
    [tenantId, eventId, t],
  );

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null);
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

  if (access.kind === 'loading') return <SurfaceState kind="loading" />;
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.messageKey ? t(access.messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('config.h_g7fjbz')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }

  async function createType() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'ticket-types'),
        { label: values.label.trim(), entitlementSnapshot: {} },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('types.h_1ic6dze'));
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice(t('types.h_13e0npu'));
        setOpen(false);
        form.resetFields();
        void load(null);
        return;
      }
      setNotice(apiErrorMessage(res.json, t('types.h_1cxyxe')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t('nav.event.types')}</Typography.Title>
        <Button type="primary" onClick={() => setOpen(true)}>{t('types.h_1caa9m7')}</Button>
      </Space>

      {kind === 'loading' ? <SurfaceState kind="loading" /> : null}
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={message}
          action={
            <Button size="small" onClick={() => void load(null)}>{t('surface.action.recheck')}</Button>
          }
        />
      ) : null}
      {kind === 'error' ? (
        <SurfaceState
          kind="error"
          description={message}
          onRetry={() => void load(null)}
        />
      ) : null}
      {kind === 'empty' ? (
        <SurfaceState
          kind="empty"
          description={t('types.h_xnio89')}
          emptyAction={
            <Button type="primary" onClick={() => setOpen(true)}>{t('types.h_1caa9m7')}</Button>
          }
        />
      ) : null}
      {kind === 'ready' ? (
        <>
          <Table
            rowKey="ticketTypeId"
            dataSource={items}
            pagination={false}
            columns={[
              { title: t('types.nhan'), dataIndex: 'label' },
              {
                title: 'ID',
                dataIndex: 'ticketTypeId',
                render: (id: string) => (
                  <Typography.Text type="secondary" copyable={{ text: id }}>
                    {id.slice(0, 8)}…
                  </Typography.Text>
                ),
              },
            ]}
          />
          {cursor ? (
            <Button onClick={() => void load(cursor)}>{t('sources.h_1w8bpuo')}</Button>
          ) : null}
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} /> : null}

      <Drawer
        title={t('types.h_1caa9m7')}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="label" label={t('types.nhan')} rules={[{ required: true }]}>
            <Input maxLength={80} />
          </Form.Item>
          <Button type="primary" loading={busy} onClick={() => void createType()}>{t('sources.tao')}</Button>
        </Form>
      </Drawer>
    </Space>
  );
}
