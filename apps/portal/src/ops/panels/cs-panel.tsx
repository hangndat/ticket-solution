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

type Props = {
  tenantId: string;
  eventId: string;
  canCs: boolean;
};

export function CsPanel({ tenantId, eventId, canCs }: Props) {
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<CsTicketSummary[]>([]);
  const [detail, setDetail] = useState<CsTicketDetail | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function applyView(view: CsView) {
    if (view.kind === 'list') {
      setList(view.items);
      setNotice(`CS: ${view.items.length} vé.`);
      return;
    }
    if (view.kind === 'detail') {
      setDetail(view.ticket);
      setNotice(`Chi tiết vé ${view.ticket.ticketId}.`);
      return;
    }
    if (view.kind === 'resent') {
      setNotice(
        `Resend queued · providerStatus ${csProviderStatusLabel(view.providerStatus)}${view.replayed ? ' · replay' : ''}. ACCEPTED ≠ delivered.`,
      );
      return;
    }
    if (view.kind === 'rejected') {
      setNotice(csResendRejectedLabel(view.code, view.message));
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
      result.networkError || result.timedOut,
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
      ticketId,
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
      ticketId,
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
          message="Hỗ trợ CS — tra cứu / timeline / resend"
          description="q chỉ nhận opaque ID chính xác. ACCEPTED từ nhà cung cấp ≠ đã giao email tới khách."
        />
        {!canCs ? (
          <Alert
            type="warning"
            showIcon
            message="Cần quyền cs.lookup từ máy chủ."
          />
        ) : (
          <Space wrap>
            <Input
              placeholder="ticketId / requestId (UUID exact)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ minWidth: 320 }}
              spellCheck={false}
            />
            <Button type="primary" loading={busy} onClick={() => void search()}>
              Tra cứu
            </Button>
          </Space>
        )}
        <Table
          size="small"
          loading={busy}
          rowKey="ticketId"
          dataSource={list}
          pagination={false}
          locale={{ emptyText: 'Chưa có kết quả.' }}
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
            >
              Resend email
            </Button>
            <Typography.Paragraph type="secondary" data-testid="cs-resend-pending">
              Resend thành công chỉ nghĩa queue/ACCEPTED phía nhà cung cấp — không
              khẳng định DELIVERED.
            </Typography.Paragraph>
          </Space>
        ) : null}
        {notice ? (
          <Typography.Text type="secondary">{notice}</Typography.Text>
        ) : null}
      </Space>
    </div>
  );
}
