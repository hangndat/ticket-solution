'use client';

import { Alert, Button, Input, Space, Table } from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../../client/use-actor-state';
import type { PortalAuditEntry } from '@ticket/contracts';
import { portalGet } from '../../client/portal-fetch';
import { bffAudit } from '../../prep/bff-urls';
import {
  buildAuditQuery,
  interpretAuditPage,
  type AuditListView,
} from '../audit';
import { usePortalLocale } from '../../i18n';
import { SavedViewsToolbar } from '../../views';

type Props = {
  tenantId: string;
  eventId: string;
};

export function AuditPanel({ tenantId, eventId }: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<AuditListView | null>(null);
  const [items, setItems] = useState<PortalAuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(
    async (cursor?: string | null, append = false) => {
      setBusy(true);
      const qs = buildAuditQuery({
        cursor,
        limit: 20,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        action: action.trim() || undefined,
      });
      const res = await portalGet(`${bffAudit(tenantId, eventId)}${qs}`);
      const next = interpretAuditPage(
        res.status,
        res.json,
        res.networkError || res.timedOut, locale,
      );
      setView(next);
      if (next.kind === 'page') {
        setItems((prev) =>
          append ? [...prev, ...next.page.items] : next.page.items,
        );
        setNextCursor(next.page.nextCursor);
      } else if (!append) {
        setItems([]);
        setNextCursor(null);
      }
      setBusy(false);
    },
    [tenantId, eventId, action, from, to, locale],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null, false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <Space
      direction="vertical"
      size="middle"
      style={{ width: '100%' }}
      data-testid="audit-log-panel"
    >
      <Alert
        type="info"
        showIcon
        message={t('ops.h_1seddb9')}
        description={t('ops.audit.filterHint')}
      />
      <SavedViewsToolbar
        tenantId={tenantId}
        eventId={eventId}
        surface="audit"
        filters={{
          action: action.trim() || undefined,
          from: from.trim() || undefined,
          to: to.trim() || undefined,
        }}
        onApply={(next) => {
          setAction(next.filters.action ?? '');
          setFrom(next.filters.from ?? '');
          setTo(next.filters.to ?? '');
        }}
      />
      <Space wrap>
        <Input
          placeholder={t('audit.filter.actionOptional')}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ minWidth: 180 }}
          allowClear
        />
        <Input
          placeholder="from ISO (…Z)"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          style={{ minWidth: 220 }}
          spellCheck={false}
        />
        <Input
          placeholder="to ISO (…Z)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={{ minWidth: 220 }}
          spellCheck={false}
        />
        <Button type="primary" loading={busy} onClick={() => void load(null, false)}>{t('platform.loc')}</Button>
      </Space>
      {view?.kind === 'rejected' || view?.kind === 'unknown' ? (
        <Alert
          type={view.kind === 'rejected' ? 'warning' : 'error'}
          showIcon
          message={view.message}
          data-testid="audit-list-status"
        />
      ) : null}
      <Table
        size="small"
        rowKey="auditId"
        loading={busy}
        dataSource={items}
        pagination={false}
        locale={{ emptyText: t('ops.h_cgehle') }}
        data-testid="audit-table"
        columns={[
          { title: t('platform.h_zdynbv'), dataIndex: 'createdAt', width: 200, ellipsis: true },
          { title: t('ops.table.action'), dataIndex: 'action', width: 160, ellipsis: true },
          { title: t('ops.table.actor'), dataIndex: 'actorUserId', ellipsis: true },
          {
            title: t('ops.table.resource'),
            dataIndex: 'resourceType',
            width: 120,
          },
          {
            title: t('ops.table.resourceId'),
            dataIndex: 'resourceId',
            ellipsis: true,
          },
          {
            title: t('ops.table.operation'),
            dataIndex: 'operationId',
            ellipsis: true,
          },
        ]}
      />
      {nextCursor ? (
        <Button loading={busy} onClick={() => void load(nextCursor, true)}>{t('platform.h_4cj11z')}</Button>
      ) : null}
    </Space>
  );
}
