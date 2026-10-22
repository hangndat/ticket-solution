'use client';

import { StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Descriptions, Result, Space } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { portalGet } from '../../../../../../src/client/portal-fetch';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import {
  formatQuotaCapacityState,
  formatQuotaRemaining,
  formatReportAsOf,
  interpretEventReport,
  reportEmailCsHref,
  reportPendingApprovalHref,
  reportShowsEmailCsCta,
  reportShowsPendingApprovalCta,
  type EventReportView,
} from '../../../../../../src/ops/report';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { GateStayAppNotice } from '../../../../../../src/components/gate-deeplink';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import {
  formatTicketStateCountLabel,
  usePortalLocale,
} from '../../../../../../src/i18n';

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
    if (!access.permissions.includes('report.read')) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access, load]);

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
  if (
    access.kind === 'permission-denied' ||
    !access.permissions.includes('report.read')
  ) {
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
            title={t('gate.report.snapshotTitle')}
            subTitle={t('analytics.asOfTag', {
              asOf: `${formatReportAsOf(shown.asOf)} UTC`,
            })}
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
                value: shown.quota.capacity === null ? '∞' : shown.quota.capacity,
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
          <Descriptions bordered size="small" column={2} style={{ marginTop: 16 }}>
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
              <Link href={reportPendingApprovalHref(tenantId, eventId)}>
                <Button data-testid="event-report-cta-pending-approval">
                  {t('gate.h_1n09r0f')}
                </Button>
              </Link>
            ) : null}
            {reportShowsEmailCsCta(shown) ? (
              <Link href={reportEmailCsHref(tenantId, eventId)}>
                <Button data-testid="event-report-cta-email-cs">
                  {t('gate.h_4twiex')}
                </Button>
              </Link>
            ) : null}
          </Space>
        </>
      ) : report === null ? (
        <SurfaceState kind="loading" />
      ) : null}

    </PortalPage>
  );
}
