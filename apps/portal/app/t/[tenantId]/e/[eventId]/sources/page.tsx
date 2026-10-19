'use client';

import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  PortalSourceSummary,
  PortalTicketTypeSummary,
} from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

export default function SourcesPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [items, setItems] = useState<PortalSourceSummary[]>([]);
  const [types, setTypes] = useState<PortalTicketTypeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [kind, setKind] = useState<'loading' | 'ready' | 'empty' | 'error' | 'unknown'>(
    'loading',
  );
  const [message, setMessage] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form] = Form.useForm<{
    name: string;
    approvalMode: 'AUTO' | 'MANUAL';
    ticketTypeId: string;
  }>();

  const load = useCallback(
    async (next?: string | null) => {
      await Promise.resolve();
      setKind('loading');
      const qs = new URLSearchParams({ limit: '20' });
      if (next) qs.set('cursor', next);
      const [res, typesRes] = await Promise.all([
        portalGet(`${bffEventAction(tenantId, eventId, 'sources')}?${qs}`),
        portalGet(`${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=50`),
      ]);
      if (res.networkError || res.timedOut || res.status >= 500) {
        setKind('unknown');
        setMessage(t('sources.h_67axiu'));
        return;
      }
      if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
        setKind('error');
        setMessage(apiErrorMessage(res.json, t('common.httpStatus', { status: res.status })));
        return;
      }
      const list = Array.isArray((res.json as { items?: unknown }).items)
        ? ((res.json as { items: PortalSourceSummary[] }).items as PortalSourceSummary[])
        : [];
      const nextCursor =
        typeof (res.json as { nextCursor?: unknown }).nextCursor === 'string'
          ? ((res.json as { nextCursor: string }).nextCursor as string)
          : null;
      setCursor(nextCursor);
      setItems(list);
      if (
        typesRes.status === 200 &&
        typesRes.json &&
        typeof typesRes.json === 'object' &&
        Array.isArray((typesRes.json as { items?: unknown }).items)
      ) {
        setTypes(
          (typesRes.json as { items: PortalTicketTypeSummary[] })
            .items as PortalTicketTypeSummary[],
        );
      }
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

  async function createSource() {
    setBusy(true);
    setNotice(null);
    try {
      const values = await form.validateFields();
      const res = await portalMutate(
        bffEventAction(tenantId, eventId, 'sources'),
        {
          name: values.name.trim(),
          approvalMode: values.approvalMode,
          ticketTypeId: values.ticketTypeId,
        },
      );
      if (res.networkError || res.timedOut || res.status >= 500) {
        setNotice(t('sources.h_duauzj'));
        return;
      }
      if (res.status === 200 || res.status === 201) {
        setNotice(t('sources.h_1p3knph'));
        setOpen(false);
        form.resetFields();
        void load(null);
        return;
      }
      setNotice(apiErrorMessage(res.json, t('sources.h_q0wodv')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t('nav.event.sources')}</Typography.Title>
        <Button type="primary" onClick={() => setOpen(true)}>{t('sources.h_1hplg8o')}</Button>
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
          description={t('sources.h_1850hrg')}
          emptyAction={
            <Button type="primary" onClick={() => setOpen(true)}>{t('sources.h_1hplg8o')}</Button>
          }
        />
      ) : null}
      {kind === 'ready' ? (
        <>
          <Table
            rowKey="sourceId"
            dataSource={items}
            pagination={false}
            columns={[
              { title: t('sources.ten'), dataIndex: 'name' },
              { title: t('sources.duyet'), dataIndex: 'approvalMode' },
              {
                title: t('nav.event.types'),
                dataIndex: 'ticketTypeIds',
                render: (ids: string[]) =>
                  (ids ?? [])
                    .map((id) => {
                      const t = types.find((x) => x.ticketTypeId === id);
                      return t?.label ?? id.slice(0, 8);
                    })
                    .join(', ') || '—',
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
        title={t('sources.h_8t861g')}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ approvalMode: 'MANUAL' }}
        >
          <Form.Item name="name" label={t('sources.ten')} rules={[{ required: true }]}>
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="approvalMode"
            label={t('guests.approvalMode')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'AUTO', label: 'AUTO' },
                { value: 'MANUAL', label: 'MANUAL' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="ticketTypeId"
            label={t('nav.event.types')}
            rules={[{ required: true, message: t('ops.import.chooseTicketTypeCatalog') }]}
          >
            <Select
              placeholder={t('ops.import.chooseTicketTypeCreated')}
              options={types.map((t) => ({
                value: t.ticketTypeId,
                label: t.label,
              }))}
              notFoundContent={t('sources.h_1pcprzj')}
            />
          </Form.Item>
          <Button type="primary" loading={busy} onClick={() => void createSource()}>{t('sources.tao')}</Button>
        </Form>
      </Drawer>
    </Space>
  );
}
