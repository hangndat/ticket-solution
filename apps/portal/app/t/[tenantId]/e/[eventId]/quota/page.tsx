'use client';

import { StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Flex, Progress, Result, Spin } from 'antd';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { portalGet } from '../../../../../../src/client/portal-fetch';
import { EventReportAsOfLine } from '../../../../../../src/components/event-report-as-of';
import { EventSetupNav } from '../../../../../../src/components/event-setup-nav';
import { PortalPage } from '../../../../../../src/components/portal-page';
import { usePortalLocale } from '../../../../../../src/i18n';
import {
  formatQuotaRemaining,
  interpretEventReport,
  type ShownEventReport,
} from '../../../../../../src/ops/report';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { isEventPagePermitted } from '../../../../../../src/prep/event-access-resolver';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';

export default function QuotaPage() {
  const { t, locale } = usePortalLocale();
  const { tenantId, eventId } = useParams<{
    tenantId: string;
    eventId: string;
  }>();
  const access = useEventAccess(tenantId, eventId);
  const [report, setReport] = useState<ShownEventReport | null>(null);
  const [quota, setQuota] = useState<{
    capacity: number | null;
    allocated: number;
  } | null>(null);
  const [kind, setKind] = useState<
    'loading' | 'ready' | 'unknown' | 'error' | 'forbidden'
  >('loading');
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    await Promise.resolve();
    setKind('loading');
    setReport(null);
    setQuota(null);
    const [res, reportRes] = await Promise.all([
      portalGet(bffEventAction(tenantId, eventId, 'quota')),
      portalGet(bffEventAction(tenantId, eventId, 'report')),
    ]);
    if (res.status === 403) {
      setKind('forbidden');
      return;
    }
    if (res.networkError || res.timedOut || res.status >= 500) {
      setMessage(t('quota.h_ti22hj'));
      setKind('unknown');
      return;
    }
    if (res.status !== 200 || !res.json || typeof res.json !== 'object') {
      setMessage(t('surface.error.loadFailed'));
      setKind('error');
      return;
    }
    const body = res.json as { capacity?: unknown; allocated?: unknown };
    if (
      (body.capacity !== null &&
        (typeof body.capacity !== 'number' ||
          !Number.isFinite(body.capacity))) ||
      typeof body.allocated !== 'number' ||
      !Number.isFinite(body.allocated)
    ) {
      setMessage(t('quota.h_dn1nvv'));
      setKind('unknown');
      return;
    }
    setQuota({
      capacity: body.capacity as number | null,
      allocated: body.allocated,
    });
    const view = interpretEventReport(
      reportRes.status,
      reportRes.json,
      Boolean(reportRes.networkError || reportRes.timedOut),
      locale,
    );
    if (
      view.kind === 'shown' &&
      view.quota.capacity === body.capacity &&
      view.quota.allocated === body.allocated
    ) {
      setReport(view);
    }
    setKind('ready');
  }, [tenantId, eventId, locale, t]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

  if (access.kind === 'loading')
    return (
      <Flex
        vertical
        align="center"
        gap="middle"
        role="status"
        aria-busy="true"
        aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
        style={{ padding: 48 }}
      >
        <Spin size="large" />
        <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
      </Flex>
    );
  if (access.kind === 'error')
    return (
      <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={access.messageKey ? t(access.messageKey) : undefined}
        action={
          <Button onClick={() => window.location.reload()}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
      />
    );
  if (
    access.kind === 'permission-denied' ||
    !isEventPagePermitted('quota', access.permissions)
  )
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('quota.permissionDenied')}
      />
    );

  const percent =
    quota?.capacity != null && quota.capacity > 0
      ? Math.min(100, Math.round((quota.allocated / quota.capacity) * 100))
      : undefined;

  return (
    <PortalPage
      title={t('nav.event.quota')}
      extra={<Button onClick={() => void load()}>{t('gate.h_3keb7')}</Button>}
      loading={kind === 'loading'}
    >
      <EventSetupNav tenantId={tenantId} eventId={eventId} current="quota" />
      {kind === 'loading' ? (
        <Flex
          vertical
          align="center"
          gap="middle"
          role="status"
          aria-busy="true"
          aria-label={t(SURFACE_MESSAGE_KEYS.loading)}
          style={{ padding: 48 }}
        >
          <Spin size="large" />
          <span>{t(SURFACE_MESSAGE_KEYS.loading)}</span>
        </Flex>
      ) : null}
      {kind === 'forbidden' ? (
        <Result
          status="403"
          title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
          subTitle={t('quota.permissionDenied')}
        />
      ) : null}
      {kind === 'unknown' || kind === 'error' ? (
        <Alert
          type={kind === 'unknown' ? 'warning' : 'error'}
          showIcon
          message={
            kind === 'unknown'
              ? t('surface.unknown.title')
              : t(SURFACE_MESSAGE_KEYS.errorLoadFailed)
          }
          description={message}
          action={
            <Button size="small" onClick={() => void load()}>
              {t(SURFACE_MESSAGE_KEYS.retry)}
            </Button>
          }
        />
      ) : null}
      {kind === 'ready' && quota ? (
        <>
          <Alert
            type="info"
            showIcon
            message={t('quota.eventWide')}
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <StatisticCard
              statistic={{
                title: t('quota.h_1h6b62d'),
                value: quota.allocated,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.stat.capacity'),
                value:
                  quota.capacity === null
                    ? t('quota.h_1tnoz3k')
                    : quota.capacity,
              }}
            />
            <StatisticCard
              statistic={{
                title: t('gate.report.remaining'),
                value: report
                  ? formatQuotaRemaining(
                      report.quotaRemaining,
                      report.quotaCapacityState,
                      locale,
                    )
                  : '—',
              }}
            />
          </div>
          {percent !== undefined ? (
            <Progress percent={percent} style={{ margin: '16px 0' }} />
          ) : null}
          {report ? <EventReportAsOfLine asOf={report.asOf} /> : null}
        </>
      ) : null}
    </PortalPage>
  );
}
