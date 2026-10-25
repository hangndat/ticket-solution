'use client';

import { Alert, Button, Input, Select, Space, Table, Typography } from 'antd';
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
import { usePortalLocale } from '../../i18n';
import { SavedViewsToolbar } from '../../views';
import { portalFieldMin } from '../../layout/density';

type CatalogItem = { id: string; label: string };

type Props = {
  tenantId: string;
  eventId: string;
  canApprove: boolean;
  sources?: CatalogItem[];
  ticketTypes?: CatalogItem[];
};

function buildBffQuery(opts: {
  sourceId?: string;
  ticketTypeId?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  params.set('status', 'PENDING_REVIEW');
  params.set('limit', '50');
  if (opts.sourceId) params.set('sourceId', opts.sourceId);
  if (opts.ticketTypeId) params.set('ticketTypeId', opts.ticketTypeId);
  if (opts.q) params.set('q', opts.q);
  return params.toString();
}

export function PendingPanel({
  tenantId,
  eventId,
  canApprove,
  sources = [],
  ticketTypes = [],
}: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<PendingView | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [ticketTypeId, setTicketTypeId] = useState<string | undefined>();
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    const qs = buildBffQuery({
      sourceId,
      ticketTypeId,
      q: q.trim() || undefined,
    });
    const result = await portalGet(
      `${bffRedemptions(tenantId, eventId)}?${qs}`,
    );
    const next = interpretPendingList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setView(next);
    setNotice(pendingListLabel(next, locale));
    setBusy(false);
  }, [tenantId, eventId, sourceId, ticketTypeId, q, locale]);

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
      locale,
    );
    setNotice(adminDecisionLabel(decision, locale));
    if (decision.kind === 'approved') void load();
    else setBusy(false);
  }

  async function deny(requestId: string) {
    const reason = denyReason.trim();
    if (!reason) {
      setNotice(t('ops.h_qdkb51'));
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
      locale,
    );
    setNotice(adminDecisionLabel(decision, locale));
    if (decision.kind === 'denied') {
      setDenyReason('');
      void load();
    } else setBusy(false);
  }

  const items: PendingItem[] = view?.kind === 'list' ? view.items : [];
  const alertType =
    view?.kind === 'rejected'
      ? 'error'
      : view?.kind === 'unknown'
        ? 'warning'
        : undefined;

  return (
    <div id="pending">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={t('ops.h_1lp1xu6')}
          description={t('ops.h_1tlh7rr')}
        />
        <SavedViewsToolbar
          tenantId={tenantId}
          eventId={eventId}
          surface="pending"
          filters={{ sourceId, ticketTypeId, q: q.trim() || undefined }}
          onApply={(next) => {
            setSourceId(next.filters.sourceId);
            setTicketTypeId(next.filters.ticketTypeId);
            setQ(next.filters.q ?? '');
          }}
        />
        <Space wrap role="search" aria-label={t('ops.pending.filtersTitle')}>
          <Select
            allowClear
            placeholder={t('ops.import.chooseSource')}
            className={portalFieldMin.w200}
            value={sourceId}
            options={sources.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(v) => setSourceId(v)}
            aria-label={t('ops.h_1u6lt1m')}
          />
          <Select
            allowClear
            placeholder={t('ops.import.chooseTicketTypeCatalog')}
            className={portalFieldMin.w200}
            value={ticketTypeId}
            options={ticketTypes.map((tt) => ({ value: tt.id, label: tt.label }))}
            onChange={(v) => setTicketTypeId(v)}
            aria-label={t('ops.h_1wib0ad')}
          />
          <Input
            placeholder={t('ops.h_k67vfi')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={portalFieldMin.w280}
            spellCheck={false}
            maxLength={64}
            aria-label={t('ops.h_1syu2ee')}
          />
          <Button
            type="primary"
            loading={busy}
            onClick={() => void load()}
            aria-label={t('ops.pending.applyFilters')}
          >
            {t('platform.loc')}
          </Button>
          <Button loading={busy} onClick={() => void load()}>
            {t('gate.h_3keb7')}
          </Button>
          <Input
            placeholder={t('ops.h_1ga5au4')}
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            className={portalFieldMin.w280}
            maxLength={500}
            aria-label={t('ops.h_1qz57kh')}
          />
        </Space>
        {alertType ? (
          <Alert
            type={alertType}
            showIcon
            message={pendingListLabel(view!, locale)}
            role="status"
          />
        ) : null}
        <Table
          size="small"
          loading={busy}
          rowKey="requestId"
          dataSource={items}
          pagination={false}
          locale={{ emptyText: t('ops.h_2gkw85') }}
          columns={[
            {
              title: t('ops.pending.col.request'),
              dataIndex: 'requestId',
              ellipsis: true,
            },
            {
              title: t('ops.pending.col.source'),
              dataIndex: 'sourceId',
              ellipsis: true,
            },
            {
              title: t('ops.pending.col.type'),
              dataIndex: 'ticketTypeId',
              ellipsis: true,
            },
            {
              title: t('ops.pending.col.created'),
              dataIndex: 'createdAt',
              ellipsis: true,
            },
            {
              title: t('ops.h_1pbxt75'),
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
                      {t('ops.pending.approve')}
                    </Button>
                    <Button
                      size="small"
                      danger
                      disabled={busy}
                      onClick={() => void deny(row.requestId)}
                    >
                      {t('ops.pending.deny')}
                    </Button>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    {t('guests.needRedemptionApprove')}
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
