'use client';

import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PortalTicketTypeSummary } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import {
  confirmDiscardIfDirty,
  useUnsavedChanges,
} from '../../../../../../src/nav/unsaved-changes';

export default function TicketTypesPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [items, setItems] = useState<PortalTicketTypeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'empty' | 'error' | 'unknown'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const savedForm = useRef(false);
  useUnsavedChanges(dirty, t('shell.unsaved.confirm'));

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
        setMessage(
          apiErrorMessage(
            res.json,
            t('common.httpStatus', { status: res.status }),
          ),
        );
        return;
      }
      const list = Array.isArray((res.json as { items?: unknown }).items)
        ? ((res.json as { items: PortalTicketTypeSummary[] })
            .items as PortalTicketTypeSummary[])
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
  if (!isEventPagePermitted('types', access.permissions)) {
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

  const canCreateType = canPerformEventAction('createType', access.permissions);

  const columns: ProColumns<PortalTicketTypeSummary>[] = [
    { title: t('types.nhan'), dataIndex: 'label' },
    {
      title: 'ID',
      dataIndex: 'ticketTypeId',
      render: (_, row) => (
        <Typography.Text type="secondary" copyable={{ text: row.ticketTypeId }}>
          {row.ticketTypeId.slice(0, 8)}…
        </Typography.Text>
      ),
    },
  ];

  return (
    <PortalPage
      title={t('nav.event.types')}
      extra={
        canCreateType ? (
          <Button
            type="primary"
            onClick={() => {
              savedForm.current = false;
              setOpen(true);
            }}
          >
            {t('types.h_1caa9m7')}
          </Button>
        ) : undefined
      }
      loading={kind === 'loading'}
    >
      {kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={message}
          action={
            <Button size="small" onClick={() => void load(null)}>
              {t('surface.action.recheck')}
            </Button>
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
            canCreateType ? (
              <Button
                type="primary"
                onClick={() => {
                  savedForm.current = false;
                  setOpen(true);
                }}
              >
                {t('types.h_1caa9m7')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {kind === 'ready' ? (
        <>
          <ProTable<PortalTicketTypeSummary>
            rowKey="ticketTypeId"
            columns={columns}
            dataSource={items}
            search={false}
            options={false}
            pagination={false}
          />
          {cursor ? (
            <Button onClick={() => void load(cursor)}>
              {t('sources.h_1w8bpuo')}
            </Button>
          ) : null}
        </>
      ) : null}

      {notice ? (
        <Alert
          type="info"
          showIcon
          message={notice}
          style={{ marginTop: 16 }}
        />
      ) : null}

      <ModalForm<{ label: string }>
        title={t('types.h_1caa9m7')}
        open={open && canCreateType}
        onOpenChange={(next) => {
          if (
            !next &&
            !savedForm.current &&
            !confirmDiscardIfDirty(t('shell.unsaved.confirm'))
          )
            return;
          savedForm.current = false;
          setOpen(next);
          if (!next) setDirty(false);
        }}
        onValuesChange={() => setDirty(true)}
        modalProps={{ destroyOnHidden: true }}
        submitter={{ submitButtonProps: { loading: busy } }}
        onFinish={async (values) => {
          if (!canCreateType) return false;
          setBusy(true);
          setNotice(null);
          try {
            const res = await portalMutate(
              bffEventAction(tenantId, eventId, 'ticket-types'),
              { label: values.label.trim(), entitlementSnapshot: {} },
            );
            if (res.networkError || res.timedOut || res.status >= 500) {
              setNotice(t('types.h_1ic6dze'));
              return false;
            }
            if (res.status === 200 || res.status === 201) {
              savedForm.current = true;
              setDirty(false);
              setNotice(t('types.h_13e0npu'));
              void load(null);
              return true;
            }
            setNotice(apiErrorMessage(res.json, t('types.h_1cxyxe')));
            return false;
          } finally {
            setBusy(false);
          }
        }}
      >
        <ProFormText
          name="label"
          label={t('types.nhan')}
          rules={[{ required: true }]}
          fieldProps={{ maxLength: 80 }}
        />
      </ModalForm>
    </PortalPage>
  );
}
