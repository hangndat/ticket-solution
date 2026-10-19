'use client';

import { Alert, Button, Input, Space, Table, Timeline, Typography } from 'antd';
import { useState } from 'react';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import { bffTickets } from '../../prep/bff-urls';
import {
  csProviderStatusLabel,
  csResendRejectedLabel,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  type CsTicketDetail,
  type CsTicketSummary,
  type CsView,
} from '../cs';
import { usePortalLocale } from '../../i18n';

type Props = {
  tenantId: string;
  eventId: string;
  canCs: boolean;
};

export function CsPanel({ tenantId, eventId, canCs }: Props) {
  const { t, locale } = usePortalLocale();
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<CsTicketSummary[]>([]);
  const [detail, setDetail] = useState<CsTicketDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function applyView(view: CsView) {
    if (view.kind === 'list') {
      setList(view.items);
      setNotice(t('ops.cs.ticketCount', { count: view.items.length }));
      return;
    }
    if (view.kind === 'detail') {
      setDetail(view.ticket);
      setNotice(t('events.ticketDetailTitle', { ticketId: view.ticket.ticketId }));
      return;
    }
    if (view.kind === 'resent') {
      setNotice(
        `Resend queued · providerStatus ${csProviderStatusLabel(view.providerStatus, locale)}${view.replayed ? t('ops.import.replaySuffix') : ''}. ACCEPTED ≠ delivered.`,
      );
      return;
    }
    if (view.kind === 'rejected') {
      setNotice(csResendRejectedLabel(view.code, view.message, locale));
      return;
    }
    setNotice(view.message);
  }

  async function search() {
    if (!canCs) return;
    setBusy(true);
    setDetail(null);
    const params = new URLSearchParams({ limit: '20' });
    if (q.trim()) params.set('q', q.trim());
    const result = await portalGet(
      `${bffTickets(tenantId, eventId)}?${params.toString()}`,
    );
    const view = interpretCsList(
      result.status,
      result.json,
      result.networkError || result.timedOut, locale,
    );
    applyView(view);
    setBusy(false);
  }

  async function openDetail(ticketId: string) {
    setBusy(true);
    const result = await portalGet(
      `${bffTickets(tenantId, eventId)}/${encodeURIComponent(ticketId)}`,
    );
    const view = interpretCsDetail(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      ticketId, locale,
    );
    applyView(view);
    setBusy(false);
  }

  async function resend(ticketId: string) {
    setBusy(true);
    const result = await portalMutate(
      `${bffTickets(tenantId, eventId)}/${encodeURIComponent(ticketId)}/resend`,
      { idempotencyKey: crypto.randomUUID() },
    );
    const view = interpretCsResend(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      ticketId, locale,
    );
    applyView(view);
    if (view.kind === 'resent') void openDetail(ticketId);
    else setBusy(false);
  }

  return (
    <div id="cs">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message={t('ops.h_1v4ywod')}
          description={t('ops.h_6lgtz')}
        />
        {!canCs ? (
          <Alert
            type="warning"
            showIcon
            message={t('ops.cs.needLookup')}
          />
        ) : (
          <Space wrap>
            <Input
              placeholder={t('ops.h_1ehht5k')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 320 }}
              spellCheck={false}
            />
            <Button type="primary" loading={busy} onClick={() => void search()}>{t('ops.h_n3x4mp')}</Button>
          </Space>
        )}
        <Table
          size="small"
          loading={busy}
          rowKey="ticketId"
          dataSource={list}
          pagination={false}
          locale={{ emptyText: t('ops.h_142nqqm') }}
          columns={[
            { title: 'Ticket', dataIndex: 'ticketId', ellipsis: true },
            { title: 'State', dataIndex: 'state', width: 100 },
            {
              title: 'Email (masked)',
              dataIndex: 'ownerEmailMasked',
              ellipsis: true,
            },
            {
              title: '',
              key: 'open',
              render: (_, row) => (
                <Button
                  size="small"
                  onClick={() => void openDetail(row.ticketId)}
                >
                  Timeline
                </Button>
              ),
            },
          ]}
        />
        {detail ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Timeline — {detail.ticketId}
            </Typography.Title>
            <Timeline
              items={(detail.timeline ?? []).map((item, idx) => ({
                key: `${item.at}-${idx}`,
                children: (
                  <span>
                    <Typography.Text strong>{item.kind}</Typography.Text>
                    {' · '}
                    {item.at}
                    {item.summary ? ` — ${item.summary}` : ''}
                  </span>
                ),
              }))}
            />
            <Button
              loading={busy}
              onClick={() => void resend(detail.ticketId)}
            >{t('ops.h_e1ks86')}</Button>
            <Typography.Paragraph type="secondary" data-testid="cs-resend-pending">{t('ops.h_mag360')}</Typography.Paragraph>
          </Space>
        ) : null}
        {notice ? (
          <Typography.Text type="secondary">{notice}</Typography.Text>
        ) : null}
      </Space>
    </div>
  );
}
