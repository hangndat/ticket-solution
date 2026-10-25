'use client';

import { ProTable } from '@ant-design/pro-components';
import type { ProColumns } from '@ant-design/pro-components';
import { Alert, Button } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { EventDetail } from '@ticket/contracts';
import { portalGet } from '../../../../src/client/portal-fetch';
import { PortalPage } from '../../../../src/components/portal-page';
import { bffEvents } from '../../../../src/prep/bff-urls';
import { useTenantAccess } from '../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../src/i18n';

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: EventDetail[]; nextCursor: string | null }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'unknown'; message: string };

function parseList(json: unknown): {
  items: EventDetail[];
  nextCursor: string | null;
} | null {
  if (!json || typeof json !== 'object') return null;
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const nextCursor =
    typeof (json as { nextCursor?: unknown }).nextCursor === 'string'
      ? ((json as { nextCursor: string }).nextCursor as string)
      : null;
  return { items: items as EventDetail[], nextCursor };
}

export default function EventsListPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(
    async (next?: string | null) => {
      await Promise.resolve();
      setList({ kind: 'loading' });
      const qs = new URLSearchParams({ limit: '20' });
      if (next) qs.set('cursor', next);
      const res = await portalGet(`${bffEvents(tenantId)}?${qs}`);
      if (res.networkError || res.timedOut || res.status === 0 || res.status >= 500) {
        setList({
          kind: 'unknown',
          message: t('events.h_byq509'),
        });
        return;
      }
      if (res.status === 403 || res.status === 401) {
        setList({ kind: 'error', message: t('events.h_o2hfl2') });
        return;
      }
      if (res.status !== 200) {
        setList({
          kind: 'error',
          message: t('events.loadFailedHttp', { status: res.status }),
        });
        return;
      }
      const parsed = parseList(res.json);
      if (!parsed) {
        setList({
          kind: 'unknown',
          message: t('events.h_j7agy6'),
        });
        return;
      }
      setCursor(parsed.nextCursor);
      setList(
        parsed.items.length === 0
          ? { kind: 'empty' }
          : { kind: 'ready', items: parsed.items, nextCursor: parsed.nextCursor },
      );
    },
    [tenantId, t],
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
        description={t('events.h_1xuhi5j')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (access.kind === 'loading' || list.kind === 'loading') {
    return <SurfaceState kind="loading" />;
  }

  const canCreate = access.tenant.tenantPermissions.includes('event.create');

  const columns: ProColumns<EventDetail>[] = [
    {
      title: t('sources.ten'),
      dataIndex: 'name',
      render: (_, row) => (
        <Link href={`/t/${tenantId}/e/${row.eventId}`}>{row.name}</Link>
      ),
    },
    { title: 'Slug', dataIndex: 'slug' },
    { title: t('common.h_fe18yl'), dataIndex: 'contentStatus' },
    { title: t('common.h_1t15e7z'), dataIndex: 'businessStatus' },
    { title: t('common.h_wqd4fq'), dataIndex: 'visibility' },
  ];

  return (
    <PortalPage
      title={t('nav.org.events')}
      extra={
        canCreate ? (
          <Link href={`/t/${tenantId}/events/new`}>
            <Button type="primary">{t('events.h_ek93o2')}</Button>
          </Link>
        ) : undefined
      }
    >
      {list.kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('surface.unknown.title')}
          description={list.message}
          action={
            <Button size="small" onClick={() => void load(null)}>{t('surface.action.recheck')}</Button>
          }
        />
      ) : null}
      {list.kind === 'error' ? (
        <SurfaceState
          kind="error"
          description={list.message}
          onRetry={() => void load(null)}
        />
      ) : null}
      {list.kind === 'empty' ? (
        <SurfaceState
          kind="empty"
          description={t('events.h_ssqyjm')}
          emptyAction={
            canCreate ? (
              <Link href={`/t/${tenantId}/events/new`}>
                <Button type="primary">{t('events.h_ek93o2')}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}
      {list.kind === 'ready' ? (
        <>
          <ProTable<EventDetail>
            rowKey="eventId"
            columns={columns}
            dataSource={list.items}
            search={false}
            options={false}
            pagination={false}
            toolBarRender={
              canCreate
                ? () => [
                    <Link key="new" href={`/t/${tenantId}/events/new`}>
                      <Button type="primary">{t('events.h_ek93o2')}</Button>
                    </Link>,
                  ]
                : false
            }
          />
          {cursor ? (
            <Button onClick={() => void load(cursor)}>{t('sources.h_1w8bpuo')}</Button>
          ) : null}
        </>
      ) : null}
    </PortalPage>
  );
}
