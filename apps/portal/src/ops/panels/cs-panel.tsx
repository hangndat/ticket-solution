'use client';

import { Alert, Button, Input, Space, Table, Timeline, Typography } from 'antd';
import { useEffect } from 'react';
import { useActorState as useState } from '../../client/use-actor-state';
import { portalGet, portalMutate } from '../../client/portal-fetch';
import { bffTickets } from '../../prep/bff-urls';
import { useMutationIntent } from '../../client/use-mutation-intent';
import { MutationIntentAlert } from '../../client/mutation-intent-alert';
import {
  csNotificationStatusText,
  csProviderStatusLabel,
  csResendRejectedLabel,
  CS_RESEND_COOLDOWN_SECONDS,
  interpretCsDetail,
  interpretCsList,
  interpretCsResend,
  type CsTicketDetail,
  type CsTicketSummary,
  type CsView,
} from '../cs';
import { usePortalLocale } from '../../i18n';
import { SavedViewsToolbar } from '../../views';
import { InContextHelp } from '../../components/in-context-help';

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
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const intent = useMutationIntent(tenantId, eventId, 'cs-resend');

  useEffect(() => {
    if (cooldownUntil === null) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= cooldownUntil) setCooldownUntil(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownSeconds = cooldownUntil === null
    ? 0 : Math.max(0, Math.ceil((cooldownUntil - nowMs) / 1000));

  function updateCooldown(ticket: CsTicketDetail) {
    const lastResend = ticket.timeline
      .filter((item) => item.kind === 'ticket.email_resend')
      .map((item) => Date.parse(item.at))
      .filter(Number.isFinite)
      .reduce((latest, at) => Math.max(latest, at), 0);
    const until = lastResend + CS_RESEND_COOLDOWN_SECONDS * 1000;
    setCooldownUntil((current) => {
      const latest = Math.max(until, current ?? 0);
      return latest > Date.now() ? latest : null;
    });
    setNowMs(Date.now());
  }

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
        t('ops.cs.resendQueued', {
          status: csProviderStatusLabel(view.providerStatus, locale),
          replaySuffix: view.replayed ? t('ops.import.replaySuffix') : '',
        }),
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
    setCooldownUntil(null);
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

  async function openDetail(ticketId: string, preserveNotice = false) {
    setBusy(true);
    if (detail?.ticketId !== ticketId) setCooldownUntil(null);
    const result = await portalGet(
      `${bffTickets(tenantId, eventId)}/${encodeURIComponent(ticketId)}`,
    );
    const view = interpretCsDetail(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      ticketId, locale,
    );
    if (view.kind === 'detail') {
      setDetail(view.ticket);
      updateCooldown(view.ticket);
      if (!preserveNotice) setNotice(t('events.ticketDetailTitle', { ticketId }));
    } else applyView(view);
    setBusy(false);
  }

  async function resend(ticketId: string) {
    setBusy(true);
    const outcome = await intent.run({ ticketId },
      (body) => portalMutate(`${bffTickets(tenantId, eventId)}/${encodeURIComponent(ticketId)}/resend`,
        { idempotencyKey: body.idempotencyKey }),
      (response) => interpretCsResend(response.status, response.json,
        response.networkError || response.timedOut, ticketId, locale).kind === 'resent');
    if (outcome.kind === 'blocked') {
      setNotice('Lần gửi lại trước chưa rõ kết quả. Kiểm tra timeline trước khi tiếp tục.');
      setBusy(false);
      return;
    }
    const result = outcome.response;
    const view = interpretCsResend(
      result.status,
      result.json,
      result.networkError || result.timedOut,
      ticketId, locale,
    );
    applyView(view);
    if (view.kind === 'resent') {
      setCooldownUntil(Date.now() + CS_RESEND_COOLDOWN_SECONDS * 1000);
      setNowMs(Date.now());
      void openDetail(ticketId, true);
    } else if (view.kind === 'rejected' &&
      (view.code === 'RESEND_COOLDOWN' || view.code === 'RESEND_LIMIT')) {
      intent.release();
      void openDetail(ticketId, true);
    } else setBusy(false);
  }

  return (
    <div id="cs">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <InContextHelp messageKey="help.cs" testId="cs-help" />
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
          <>
            <SavedViewsToolbar
              tenantId={tenantId}
              eventId={eventId}
              surface="cs"
              filters={{ q: q.trim() || undefined }}
              onApply={(next) => {
                setQ(next.filters.q ?? '');
              }}
            />
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
          </>
        )}
        <Table
          size="small"
          loading={busy}
          rowKey="ticketId"
          dataSource={list}
          pagination={false}
          locale={{ emptyText: t('ops.h_142nqqm') }}
          columns={[
            {
              title: t('ops.table.ticket'),
              dataIndex: 'ticketId',
              ellipsis: true,
            },
            { title: t('ops.table.state'), dataIndex: 'state', width: 100 },
            {
              title: t('ops.table.emailMasked'),
              dataIndex: 'ownerEmailMasked',
              ellipsis: true,
            },
            {
              title: t('ops.table.providerStatus'),
              key: 'providerStatus',
              render: (_, row) => (
                <span>{csNotificationStatusText(row.notification, locale)}</span>
              ),
            },
            {
              title: '',
              key: 'open',
              render: (_, row) => (
                <Button
                  size="small"
                  onClick={() => void openDetail(row.ticketId)}
                >
                  {t('ops.table.timeline')}
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
                    {item.summary ? (
                      <>
                        {' — '}
                        <Typography.Text>{item.summary}</Typography.Text>
                      </>
                    ) : null}
                  </span>
                ),
              }))}
            />
            <Button
              loading={busy}
              disabled={cooldownSeconds > 0 || !canCs}
              onClick={() => void resend(detail.ticketId)}
            >{t('ops.h_e1ks86')}</Button>
            {cooldownSeconds > 0 ? (
              <Typography.Text type="secondary" role="status">
                {t('ops.cs.cooldownRemaining', { seconds: cooldownSeconds })}
              </Typography.Text>
            ) : null}
            <Typography.Paragraph type="secondary" data-testid="cs-resend-pending">{t('ops.h_mag360')}</Typography.Paragraph>
          </Space>
        ) : null}
        {notice ? (
          <Typography.Text type="secondary">{notice}</Typography.Text>
        ) : null}
        <MutationIntentAlert pending={intent.pending} needsReconciliation={intent.needsReconciliation}
          onCheck={() => { if (detail) void openDetail(detail.ticketId); }} onStartNew={intent.release} />
      </Space>
    </div>
  );
}
