'use client';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Result,
  Space,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { gateDeeplinkUrl } from '../../../../../../src/oidc/config';
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
import {
  GateDeeplinkButton,
  GateStayAppNotice,
} from '../../../../../../src/components/gate-deeplink';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

/**
 * GATE-STAY-APP: O12 report surface only — never mount scanner on portal.
 */
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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        {t('gate.h_1klnels')}
      </Typography.Title>
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
        <Card
          size="small"
          title="Snapshot"
          extra={
            <Typography.Text type="secondary">
              asOf {formatReportAsOf(shown.asOf)} UTC
            </Typography.Text>
          }
        >
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Quota allocated">
              {shown.quota.allocated}
            </Descriptions.Item>
            <Descriptions.Item label="Capacity">
              {shown.quota.capacity === null ? '∞' : shown.quota.capacity}
            </Descriptions.Item>
            <Descriptions.Item label="Capacity state">
              {formatQuotaCapacityState(shown.quotaCapacityState, locale)}
            </Descriptions.Item>
            <Descriptions.Item label="Remaining">
              {formatQuotaRemaining(
                shown.quotaRemaining,
                shown.quotaCapacityState,
                locale,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('gate.h_1nc3sip')}>
              <span data-testid="event-report-pending-approval">
                {shown.pendingApprovalCount}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={t('gate.h_icax5j')}>
              {shown.emailNeedsCsCount}
            </Descriptions.Item>
            <Descriptions.Item label="Check-in OK">
              {shown.checkInSuccessCount}
            </Descriptions.Item>
            <Descriptions.Item label={t('gate.h_1swn6cq')}>
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
        </Card>
      ) : report === null ? (
        <SurfaceState kind="loading" />
      ) : null}

      {access.permissions.includes('gate.confirm') ? (
        <div>
          <Typography.Paragraph>{t('gate.h_cq4fvf')}</Typography.Paragraph>
          <GateDeeplinkButton
            href={gateDeeplinkUrl(process.env, '/gate', {
              tenantId,
              eventId,
            })}
          />
        </div>
      ) : null}
    </Space>
  );
}
