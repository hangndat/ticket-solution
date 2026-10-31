'use client';

import { StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Flex, Result, Space, Spin } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../../../../../../src/client/use-actor-state';
import { portalGet } from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import {
  formatQuotaCapacityState,
  formatQuotaRemaining,
  interpretEventReport,
  reportEmailCsHref,
  reportPendingApprovalHref,
  reportShowsEmailCsCta,
  reportShowsPendingApprovalCta,
  type EventReportView,
} from '../../../../../../src/ops/report';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import { GatesPanel } from '../../../../../../src/gates/gates-panel';
import { GateStayAppNotice } from '../../../../../../src/components/gate-deeplink';
import { EventReportAsOfLine } from '../../../../../../src/components/event-report-as-of';
import { ReportStaleAlert } from '../../../../../../src/components/report-stale-alert';
import {
  formatTicketStateCountLabel,
  usePortalLocale,
} from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';

/** O12 report surface only — staff scan on Vemoki iOS app (D-6). */
export default function EventGateReportPage() {
  const { t, locale } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [report, setReport] = useState<EventReportView | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const result = await portalGet(bffEventAction(tenantId, eventId, 'report'));
    setReport(
      interpretEventReport(
        result.status,
        result.json,
        result.networkError || result.timedOut,
        locale,
      ),
    );
    setBusy(false);
  }, [tenantId, eventId, locale]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    if (!canPerformEventAction('readReport', access.permissions)) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access, load]);

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
        title={t('gate.h_iosgib')}
        subTitle={t('gate.needReportRead')}
      />
    );
  }
  if (!isEventPagePermitted('gate', access.permissions)) {
    return (
      <Result
        status="403"
        title={t('gate.h_iosgib')}
        subTitle={t('gate.needReportRead')}
      />
    );
  }

  const shown = report?.kind === 'shown' ? report : null;

  return (
    <PortalPage title={t('gate.h_1klnels')}>
      <GateStayAppNotice />

      {shown ? (
        <ReportStaleAlert
          asOf={shown.asOf}
          loading={busy}
          onRefresh={() => void load()}
        />
      ) : null}

      {report?.kind === 'unknown' || report?.kind === 'rejected' ? (
        <Alert
          type="warning"
          showIcon
          message={
            report.kind === 'rejected'
              ? t('ops.export.apiRejected', {
                  code: report.code,
                  message: report.message,
                })
              : report.message
          }
          action={
            <Button size="small" loading={busy} onClick={() => void load()}>
              {t('surface.action.retry')}
            </Button>
          }
        />
      ) : null}

      {shown ? (
        <>
          <StatisticCard.Group
            className="portal-gate-report-compact"
            title={t('gate.report.snapshotTitle')}
            subTitle={<EventReportAsOfLine asOf={shown.asOf} />}
          >
            <StatisticCard
              statistic={{
                title: t('gate.stat.quotaAllocated'),
                value: shown.quota.allocated,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.stat.capacity'),
                value:
                  shown.quota.capacity === null ? '∞' : shown.quota.capacity,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.h_1nc3sip'),
                value: shown.pendingApprovalCount,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.stat.checkInOk'),
                value: shown.checkInSuccessCount,
              }}
            />
          </StatisticCard.Group>
          <Descriptions
            bordered
            size="small"
            column={2}
            style={{ marginTop: 16 }}
          >
            <Descriptions.Item label={t('gate.report.capacityState')}>
              {formatQuotaCapacityState(shown.quotaCapacityState, locale)}
            </Descriptions.Item>
            <Descriptions.Item label={t('gate.report.remaining')}>
              {formatQuotaRemaining(
                shown.quotaRemaining,
                shown.quotaCapacityState,
                locale,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('gate.h_icax5j')}>
              {shown.emailNeedsCsCount}
            </Descriptions.Item>
            <Descriptions.Item
              label={formatTicketStateCountLabel(locale, 'ACTIVE')}
            >
              {shown.ticketsByState.ACTIVE}
            </Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 16 }} wrap>
            <Button loading={busy} onClick={() => void load()}>
              {t('gate.h_3keb7')}
            </Button>
            {reportShowsPendingApprovalCta(shown) ? (
              <Link prefetch={false} href={reportPendingApprovalHref(tenantId, eventId)}>
                <Button data-testid="event-report-cta-pending-approval">
                  {t('gate.h_1n09r0f')}
                </Button>
              </Link>
            ) : null}
            {reportShowsEmailCsCta(shown) ? (
              <Link prefetch={false} href={reportEmailCsHref(tenantId, eventId)}>
                <Button data-testid="event-report-cta-email-cs">
                  {t('gate.h_4twiex')}
                </Button>
              </Link>
            ) : null}
          </Space>
        </>
      ) : report === null ? (
        (
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
  )
      ) : null}

      <GatesPanel
        tenantId={tenantId}
        eventId={eventId}
        canCreate={canPerformEventAction('updateEvent', access.permissions)}
      />
    </PortalPage>
  );
}
