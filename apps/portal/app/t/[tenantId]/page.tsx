'use client';

import { ProList, StatisticCard } from '@ant-design/pro-components';
import { Alert, Button, Empty, Flex, Result, Spin, Typography } from 'antd';
import { PortalPage } from '../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { useActorState as useState } from '../../../src/client/use-actor-state';
import { useTenantAccess } from '../../../src/prep/use-event-access';
import {
  canPerformTenantAction,
  firstAllowedEventPath,
} from '../../../src/nav/capability-policy';
import {
  formatTenantRole,
  formatTenantStatus,
  usePortalLocale,
} from '../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../src/prep/surface-copy';
import { isPendingActivationStatus } from '../../../src/onboarding';
import { portalGet } from '../../../src/client/portal-fetch';
import { bffPortfolio } from '../../../src/prep/bff-urls';
import {
  interpretPortfolio,
  type ShownPortfolioItem,
} from '../../../src/ops/portfolio';
import {
  OVERVIEW_STAGE_ORDER,
  overviewWorkItems,
  type OverviewStage,
} from '../../../src/ops/overview-work';
import { displayedSnapshotAsOf } from '../../../src/ops/tenant-limits-usage';
import { formatReportAsOf, isReportDataStale } from '../../../src/ops/report';
import { ReportStaleAlert } from '../../../src/components/report-stale-alert';
import { InContextHelp } from '../../../src/components/in-context-help';
import { TenantLimitsCard } from '../../../src/components/tenant-limits-card';

const STAGE_TITLE: Record<OverviewStage, 'overview.stage.prep' | 'overview.stage.issue' | 'overview.stage.dayOf' | 'overview.stage.after'> = {
  prep: 'overview.stage.prep',
  issue: 'overview.stage.issue',
  dayOf: 'overview.stage.dayOf',
  after: 'overview.stage.after',
};

export default function TenantOverviewPage() {
  const { t, locale } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useTenantAccess(tenantId);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<ShownPortfolioItem[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const loadPortfolio = useCallback(async () => {
    if (access.kind !== 'ready') return;
    const canReport = access.events.some((event) =>
      event.permissions.includes('report.read'),
    );
    if (!canReport) {
      setAsOf(null);
      setPortfolioItems([]);
      return;
    }
    const res = await portalGet(`${bffPortfolio(tenantId)}?limit=20`);
    const view = interpretPortfolio(
      res.status,
      res.json,
      res.networkError || res.timedOut,
      locale,
    );
    if (view.kind !== 'shown') {
      setAsOf(null);
      setPortfolioItems([]);
      return;
    }
    setAsOf(view.asOf);
    setPortfolioItems(view.items.filter((item): item is ShownPortfolioItem => item.kind === 'shown'));
  }, [access, tenantId, locale]);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadPortfolio();
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, loadPortfolio]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const work = useMemo(() => {
    if (access.kind !== 'ready') return [];
    return overviewWorkItems({
      tenantId,
      tenantPermissions: access.tenant.tenantPermissions,
      events: access.events,
      portfolioItems,
    });
  }, [access, tenantId, portfolioItems]);

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
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('common.h_yw94nu')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = '/';
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const { tenant, events } = access;

  if (isPendingActivationStatus(tenant.status)) {
    return (
      <Result status="info" title={t('onboarding.pending.title')} subTitle={t('onboarding.pending.body', {
          name: tenant.name,
          slug: tenant.slug,
        })} extra={<Link prefetch={false} href={`/onboarding/${tenantId}`}>
            <Button type="primary">{t('onboarding.pending.openWait')}</Button>
          </Link>} />
    );
  }

  const canCreate = canPerformTenantAction(
    'createEvent',
    tenant.tenantPermissions,
  );
  const canList = canPerformTenantAction(
    'listEvents',
    tenant.tenantPermissions,
  );
  const displayedAsOf = asOf ? displayedSnapshotAsOf(asOf) : null;
  const stale = displayedAsOf ? isReportDataStale(displayedAsOf, nowMs) : false;

  return (
    <PortalPage
      title={tenant.name}
      subTitle={t('tenant.home.meta', {
        slug: tenant.slug,
        role: formatTenantRole(locale, tenant.role),
        status: formatTenantStatus(locale, tenant.status),
      })}
      extra={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canList ? (
            <Link prefetch={false} href={`/t/${tenantId}/events`}>
              <Button>{t('common.h_8mpr7p')}</Button>
            </Link>
          ) : null}
          {canCreate ? (
            <Link prefetch={false} href={`/t/${tenantId}/events/new`}>
              <Button type="primary">{t('events.h_ek93o2')}</Button>
            </Link>
          ) : null}
          {canPerformTenantAction('manageMembers', tenant.tenantPermissions) ? (
            <Link prefetch={false} href={`/t/${tenantId}/members`}>
              <Button>{t('nav.org.members')}</Button>
            </Link>
          ) : null}
        </div>
      }
    >
      <InContextHelp messageKey="overview.help" testId="overview-help" />
      {displayedAsOf ? (
        <Typography.Paragraph type="secondary" data-testid="overview-asof">
          {t('overview.freshness')}{' '}
          {t('analytics.asOfTag', { asOf: formatReportAsOf(displayedAsOf, locale) })}
        </Typography.Paragraph>
      ) : null}
      {displayedAsOf && stale ? (
        <ReportStaleAlert asOf={displayedAsOf} onRefresh={() => void loadPortfolio()} />
      ) : null}

      {canPerformTenantAction('editSettings', tenant.tenantPermissions) ? (
        <TenantLimitsCard tenantId={tenantId} />
      ) : null}

      <StatisticCard.Group style={{ marginBottom: 16 }}>
        <StatisticCard
          statistic={{ title: t('nav.org.events'), value: events.length }}
        />
      </StatisticCard.Group>

      {OVERVIEW_STAGE_ORDER.map((stage) => {
        const cards = work.filter((item) => item.stage === stage);
        if (cards.length === 0) return null;
        return (
          <ProList
            key={stage}
            headerTitle={t(STAGE_TITLE[stage])}
            dataSource={cards}
            metas={{
              title: {
                render: (_, row) => t(row.titleKey),
              },
              description: {
                render: (_, row) => row.eventTitle,
              },
              actions: {
                render: (_, row) => [
                  <Link prefetch={false} key="open" href={row.href} data-testid={`overview-work-${row.id}`}>
                    {t('common.mo')}
                  </Link>,
                ],
              },
            }}
          />
        );
      })}

      {events.length === 0 ? (
        <Empty description={t('common.h_1bzxqwd')} style={{ padding: 48 }}>
          {
            canCreate ? (
              <Link prefetch={false} href={`/t/${tenantId}/events/new`}>
                <Button type="primary">{t('events.h_ek93o2')}</Button>
              </Link>
            ) : undefined
          }
        </Empty>
      ) : (
        <ProList
          headerTitle={t('common.h_6izk0k')}
          dataSource={events}
          metas={{
            title: { dataIndex: 'name' },
            description: {
              render: (_, row) =>
                t('common.eventPermissions', { count: row.permissions.length }),
            },
            actions: {
              render: (_, row) => [
                firstAllowedEventPath(row) ? (
                  <Link prefetch={false} key="open" href={firstAllowedEventPath(row)!}>
                    {t('common.mo')}
                  </Link>
                ) : null,
              ],
            },
          }}
        />
      )}
    </PortalPage>
  );
}
