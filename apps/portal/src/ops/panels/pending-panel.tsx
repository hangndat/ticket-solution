'use client';

import { Alert, Button, Input, Modal, Select, Space, Table, Typography } from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../../client/use-actor-state';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import { isUuid } from '../../bff/ids';
import { bffRedemptions } from '../../prep/bff-urls';
import { decideAdmin, adminDecisionLabel, type AdminDecision } from '../decide';
import {
  interpretPendingList,
  pendingListLabel,
  type PendingItem,
  type PendingView,
} from '../pending';
import { usePortalLocale } from '../../i18n';
import { SavedViewsToolbar } from '../../views';
import { useMutationIntent } from '../../client/use-mutation-intent';
import { MutationIntentAlert } from '../../client/mutation-intent-alert';

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
  const [denyRequestId, setDenyRequestId] = useState<string | null>(null);
  const [decision, setDecision] = useState<AdminDecision | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const intent = useMutationIntent(tenantId, eventId, 'pending-decision');
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [ticketTypeId, setTicketTypeId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState<{ sourceId?: string; ticketTypeId?: string; q?: string }>({});
  const [cursor, setCursor] = useState<string | null>(null);

  const load = useCallback(async (preserveNotice = false) => {
    setBusy(true);
    const qs = buildBffQuery({
      ...applied,
    });
    const url = new URLSearchParams(qs);
    if (cursor) url.set('cursor', cursor);
    const result = await portalGet(
      `${bffRedemptions(tenantId, eventId)}?${url}`,
    );
    const next = interpretPendingList(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setView(next);
    if (!preserveNotice) setNotice(pendingListLabel(next, locale));
    setBusy(false);
  }, [tenantId, eventId, applied, cursor, locale]);

  function applyFilters() {
    const requestId = q.trim();
    if (requestId && !isUuid(requestId)) {
      setNotice(t('ops.pending.invalidRequestId'));
      return;
    }
    const next = { sourceId, ticketTypeId, q: requestId || undefined };
    const unchanged = sourceId === applied.sourceId && ticketTypeId === applied.ticketTypeId &&
      next.q === applied.q;
    if (unchanged && !cursor) {
      void load();
      return;
    }
    setCursor(null);
    if (!unchanged) setApplied(next);
  }

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
    setDecision(null);
    setBusy(true);
    const outcome = await intent.run(
      { requestId, decision: 'approve' },
      (body) => portalMutate(`${bffRedemptions(tenantId, eventId)}/${encodeURIComponent(requestId)}/approve`,
        { idempotencyKey: body.idempotencyKey }),
      (response) => decideAdmin('approve', response.status, response.json,
        response.networkError || response.timedOut, locale).kind === 'approved',
    );
    if (outcome.kind === 'blocked') {
      setNotice('Quyết định trước chưa rõ kết quả. Kiểm tra yêu cầu trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const result = outcome.response;
    const decision = decideAdmin(
      'approve',
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setDecision(decision);
    setNotice(adminDecisionLabel(decision, locale));
    if (decision.kind === 'approved') void load(true);
    else setBusy(false);
  }

  async function deny(requestId: string) {
    const reason = denyReason.trim();
    if (!reason) {
      setNotice(t('ops.h_qdkb51'));
      return;
    }
    setBusy(true);
    setDecision(null);
    const outcome = await intent.run(
      { requestId, decision: 'deny', reason },
      (body) => portalMutate(`${bffRedemptions(tenantId, eventId)}/${encodeURIComponent(requestId)}/deny`,
        { reason: body.reason, idempotencyKey: body.idempotencyKey }),
      (response) => decideAdmin('deny', response.status, response.json,
        response.networkError || response.timedOut, locale).kind === 'denied',
    );
    if (outcome.kind === 'blocked') {
      setNotice('Quyết định trước chưa rõ kết quả. Kiểm tra yêu cầu trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const result = outcome.response;
    const decision = decideAdmin(
      'deny',
      result.status,
      result.json,
      result.networkError || result.timedOut,
      locale,
    );
    setDecision(decision);
    setNotice(adminDecisionLabel(decision, locale));
    if (decision.kind === 'denied') {
      setDenyReason('');
      setDenyRequestId(null);
      setBusy(false);
      void load(true);
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
            setCursor(null);
            setApplied({ sourceId: next.filters.sourceId, ticketTypeId: next.filters.ticketTypeId,
              q: next.filters.q });
          }}
        />
        <Space wrap role="search" aria-label={t('ops.pending.filtersTitle')}>
          <Select
            allowClear
            placeholder={t('ops.import.chooseSource')}
            style={{ minWidth: 200 }}
            value={sourceId}
            options={sources.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(v) => setSourceId(v)}
            aria-label={t('ops.h_1u6lt1m')}
          />
          <Select
            allowClear
            placeholder={t('ops.import.chooseTicketTypeCatalog')}
            style={{ minWidth: 200 }}
            value={ticketTypeId}
            options={ticketTypes.map((tt) => ({ value: tt.id, label: tt.label }))}
            onChange={(v) => setTicketTypeId(v)}
            aria-label={t('ops.h_1wib0ad')}
          />
          <Input
            placeholder={t('ops.pending.requestUuidHint')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 280 }}
            spellCheck={false}
            maxLength={64}
            aria-label={t('ops.pending.requestUuidHint')}
          />
          <Button
            type="primary"
            loading={busy}
            onClick={applyFilters}
            aria-label={t('ops.pending.applyFilters')}
          >
            {t('platform.loc')}
          </Button>
          <Button loading={busy} onClick={() => void load()}>
            {t('gate.h_3keb7')}
          </Button>
        </Space>
        {decision?.kind === 'rejected' && decision.code === 'QUOTA_EXHAUSTED' ? (
          <Alert type="error" showIcon message="QUOTA_EXHAUSTED"
            description={<Space wrap><span>{t('ops.pending.quotaExhausted')}</span>
              <Button href={`/t/${encodeURIComponent(tenantId)}/e/${encodeURIComponent(eventId)}/quota`}>
                {t('ops.pending.openQuota')}
              </Button></Space>} />
        ) : null}
        {alertType ? (
          <Alert
            type={alertType}
            showIcon
            message={pendingListLabel(view!, locale)}
            role="status"
          />
        ) : null}
        <MutationIntentAlert pending={intent.pending} needsReconciliation={intent.needsReconciliation}
          onCheck={() => void load()} onStartNew={intent.release} />
        <Table
          size="small"
          loading={busy}
          rowKey="requestId"
          dataSource={items}
          pagination={false}
          scroll={{ x: 'max-content' }}
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
              render: (id: string | null) => id
                ? sources.find((source) => source.id === id)?.label ?? t('ops.pending.catalogUnavailable')
                : '—',
            },
            {
              title: t('ops.pending.col.type'),
              dataIndex: 'ticketTypeId',
              ellipsis: true,
              render: (id: string | null) => id
                ? ticketTypes.find((type) => type.id === id)?.label ?? t('ops.pending.catalogUnavailable')
                : '—',
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
                      onClick={() => { setDenyRequestId(row.requestId); setDenyReason(''); }}
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
        {view?.kind === 'list' && view.nextCursor ? (
          <Button disabled={busy} onClick={() => setCursor(view.nextCursor)}>
            {t('ops.pending.nextPage')}
          </Button>
        ) : null}
        <Modal key={denyRequestId ?? 'closed'} title={t('ops.pending.deny')}
          open={denyRequestId !== null} destroyOnHidden
          onCancel={() => { if (!busy) setDenyRequestId(null); }}
          onOk={() => { if (denyRequestId) void deny(denyRequestId); }}
          okText={t('ops.pending.deny')} okButtonProps={{ danger: true, disabled: !denyReason.trim(), loading: busy }}
          cancelButtonProps={{ disabled: busy }}>
          <Typography.Paragraph>{t('ops.pending.denyReasonHelp')}</Typography.Paragraph>
          <Input.TextArea value={denyReason} onChange={(e) => setDenyReason(e.target.value)}
            rows={3} maxLength={500} showCount aria-label={t('ops.pending.denyReasonHelp')} />
        </Modal>
        {notice ? (
          <Typography.Text type="secondary" data-testid="pending-notice">
            {notice}
          </Typography.Text>
        ) : null}
      </Space>
    </div>
  );
}
