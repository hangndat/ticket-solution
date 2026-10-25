'use client';

import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Form } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
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
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
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
  if (!isEventPagePermitted('sources', access.permissions)) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('config.h_g7fjbz')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
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

  const columns: ProColumns<PortalSourceSummary>[] = [
    { title: t('sources.ten'), dataIndex: 'name' },
    { title: t('sources.duyet'), dataIndex: 'approvalMode' },
    {
      title: t('nav.event.types'),
      dataIndex: 'ticketTypeIds',
      render: (_, row) =>
        (row.ticketTypeIds ?? [])
          .map((id) => {
            const ty = types.find((x) => x.ticketTypeId === id);
            return ty?.label ?? id.slice(0, 8);
          })
          .join(', ') || '—',
    },
  ];

  return (
    <PortalPage
      title={t('nav.event.sources')}
      extra={<Button type="primary" onClick={() => setOpen(true)}>{t('sources.h_1hplg8o')}</Button>}
      loading={kind === 'loading'}
    >
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
          <ProTable<PortalSourceSummary>
            rowKey="sourceId"
            columns={columns}
            dataSource={items}
            search={false}
            options={false}
            pagination={false}
          />
          {cursor ? (
            <Button onClick={() => void load(cursor)}>{t('sources.h_1w8bpuo')}</Button>
          ) : null}
        </>
      ) : null}

      {notice ? <Alert type="info" showIcon message={notice} style={{ marginTop: 16 }} /> : null}

      <ModalForm
        title={t('sources.h_8t861g')}
        open={open}
        onOpenChange={setOpen}
        form={form}
        initialValues={{ approvalMode: 'MANUAL' }}
        modalProps={{ destroyOnHidden: true }}
        submitter={{ submitButtonProps: { loading: busy } }}
        onFinish={async () => {
          await createSource();
          return true;
        }}
      >
        <ProFormText name="name" label={t('sources.ten')} rules={[{ required: true }]} fieldProps={{ maxLength: 80 }} />
        <ProFormSelect
          name="approvalMode"
          label={t('guests.approvalMode')}
          rules={[{ required: true }]}
          options={[
            { value: 'AUTO', label: 'AUTO' },
            { value: 'MANUAL', label: 'MANUAL' },
          ]}
        />
        <ProFormSelect
          name="ticketTypeId"
          label={t('nav.event.types')}
          rules={[{ required: true, message: t('ops.import.chooseTicketTypeCatalog') }]}
          options={types.map((ty) => ({
            value: ty.ticketTypeId,
            label: ty.label,
          }))}
          fieldProps={{
            placeholder: t('ops.import.chooseTicketTypeCreated'),
            notFoundContent: t('sources.h_1pcprzj'),
          }}
        />
      </ModalForm>
    </PortalPage>
  );
}
