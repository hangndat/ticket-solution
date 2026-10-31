'use client';

import { ModalForm, ProFormText, ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button, Empty, Flex, Result, Spin, Typography } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { useActorState as useState } from '../../../../../../src/client/use-actor-state';
import type { PortalTicketTypeSummary } from '@ticket/contracts';
import {
  apiErrorMessage,
  portalGet,
  portalMutate,
} from '../../../../../../src/client/portal-fetch';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { EventSetupNav } from '../../../../../../src/components/event-setup-nav';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';
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
    'loading' | 'ready' | 'empty' | 'error' | 'unknown' | 'forbidden'
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
      if (res.status === 403) {
        setKind('forbidden');
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

  if (access.kind === 'loading') return (
    <Flex
      vertical
      align="center"
      gap="middle"
      role="status"
      aria-busy="true"
      aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
      suppressHydrationWarning
      style={{ padding: 48 }}
    >
      <Spin size="large" />
      <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
    </Flex>
  );
  if (access.kind === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={access.messageKey ? t(access.messageKey) : undefined}
        action={
          <Button size="small" onClick={() => window.location.reload()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
    );
  }
  if (access.kind === 'permission-denied') {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('config.h_g7fjbz')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }
  if (!isEventPagePermitted('types', access.permissions)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('config.h_g7fjbz')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
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
      <EventSetupNav tenantId={tenantId} eventId={eventId} current="types" />
      {kind === 'forbidden' ? (
        <Result status="403" title={t(SURFACE_MESSAGE_KEYS.permissionTitle)} subTitle={t('surface.permission.defaultDescription')} />
      ) : null}
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
        <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={message}
        action={
          <Button size="small" onClick={() => void load(null)}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
      ) : null}
      {kind === 'empty' ? (
        <Empty description={t('types.h_xnio89')} style={{ padding: 48 }}>
          {
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
        </Empty>
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
