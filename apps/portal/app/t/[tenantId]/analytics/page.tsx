'use client';

import { ProTable } from '@ant-design/pro-components';
import { Alert, Button, Empty, Flex, Result, Spin, Tag, Tooltip } from 'antd';
import { PortalPage } from '../../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { portalGet } from '../../../../src/client/portal-fetch';
import { usePortalLocale } from '../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../src/prep/surface-copy';
import {
  formatPortfolioMetric,
  formatQuotaRemaining,
  formatReportAsOf,
  interpretPortfolio,
  portfolioEventHref,
  type PortfolioItemView,
} from '../../../../src/ops/portfolio';
import { bffPortfolio } from '../../../../src/prep/bff-urls';
import { useAnalyticsAccess } from '../../../../src/prep/use-event-access';

type PageState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      asOf: string;
      items: PortfolioItemView[];
      nextCursor: string | null;
      hasPartial: boolean;
    }
  | { kind: 'empty'; asOf: string }
  | { kind: 'error'; message: string }
  | { kind: 'unknown'; message: string }
  | { kind: 'rejected'; message: string };

function metricCell(item: PortfolioItemView, value: number | null): ReactNode {
  if (item.kind === 'unknown') {
    return (
      <Tooltip title={item.message}>
        <span aria-label={item.message}>—</span>
      </Tooltip>
    );
  }
  return formatPortfolioMetric(value);
}

function rowKey(row: PortfolioItemView, index?: number): string {
  if (row.eventId) return row.eventId;
  return `unknown-${index ?? 0}`;
}

export default function AnalyticsPortfolioPage() {
  const { t, locale } = usePortalLocale();
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;
  const access = useAnalyticsAccess(tenantId);
  const eventPath = (eventId: string): string | null => {
    const event =
      access.kind === 'ready'
        ? access.events.find((item) => item.eventId === eventId)
        : null;
    return event
      ? portfolioEventHref(tenantId, eventId, event.permissions)
      : null;
  };
  const [page, setPage] = useState<PageState>({ kind: 'loading' });

  const load = useCallback(
    async (next?: string | null, append = false) => {
      if (!append) setPage({ kind: 'loading' });

      const qs = new URLSearchParams({ limit: '20' });
      if (next) qs.set('cursor', next);
      const res = await portalGet(`${bffPortfolio(tenantId)}?${qs}`);
      const view = interpretPortfolio(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      );

      if (view.kind === 'unknown') {
        setPage({ kind: 'unknown', message: view.message });
        return;
      }
      if (view.kind === 'rejected') {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setPage({
            kind: 'rejected',
            message: t('analytics.deniedBff'),
          });
          return;
        }
        setPage({ kind: 'error', message: view.message });
        return;
      }

      if (append) {
        setPage((prev) => {
          const prevItems = prev.kind === 'ready' ? prev.items : [];
          const prevPartial = prev.kind === 'ready' ? prev.hasPartial : false;
          const items = [...prevItems, ...view.items];
          if (items.length === 0) {
            return { kind: 'empty', asOf: view.asOf };
          }
          return {
            kind: 'ready',
            asOf: view.asOf,
            items,
            nextCursor: view.nextCursor,
            hasPartial: prevPartial || view.hasPartial,
          };
        });
        return;
      }

      if (view.items.length === 0) {
        setPage({ kind: 'empty', asOf: view.asOf });
        return;
      }
      setPage({
        kind: 'ready',
        asOf: view.asOf,
        items: view.items,
        nextCursor: view.nextCursor,
        hasPartial: view.hasPartial,
      });
    },
    [tenantId, locale, t],
  );

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load(null, false);
    });
    return () => {
      cancelled = true;
    };
  }, [access.kind, load]);

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
  if (access.kind === 'permission-denied' || page.kind === 'rejected') {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={page.kind === 'rejected' ? page.message : t('analytics.deniedAccess')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }
  if (access.kind === 'loading' || page.kind === 'loading') {
    return (
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
  }

  const canListEvents = access.tenant.tenantPermissions.includes('event.list');
  const asOf =
    page.kind === 'ready' || page.kind === 'empty' ? page.asOf : null;

  return (
    <PortalPage
      title={t('nav.org.analytics')}
      subTitle={
        asOf ? (
          <Tag data-testid="portfolio-asof">
            {t('analytics.asOfTag', { asOf: formatReportAsOf(asOf, locale) })}
          </Tag>
        ) : undefined
      }
      extra={
        <Button
          type="primary"
          onClick={() => void load(null, false)}
          data-testid="portfolio-refresh"
        >
          {t('gate.h_3keb7')}
        </Button>
      }
    >
      {page.kind === 'ready' && page.hasPartial ? (
        <Alert
          type="warning"
          showIcon
          message={t('ops.portfolio.partial')}
          data-testid="portfolio-partial-alert"
        />
      ) : null}

      {page.kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message={t('analytics.unknownTitle')}
          description={page.message}
          action={
            <Button size="small" onClick={() => void load(null, false)}>
              {t('surface.action.recheck')}
            </Button>
          }
        />
      ) : null}

      {page.kind === 'error' ? (
        <Alert
        type="error"
        showIcon
        message={t(SURFACE_MESSAGE_KEYS.errorLoadFailed)}
        description={page.message}
        action={
          <Button size="small" onClick={() => void load(null, false)}>
            {t(SURFACE_MESSAGE_KEYS.retry)}
          </Button>
        }
        style={{ margin: 24 }}
      />
      ) : null}

      {page.kind === 'empty' ? (
        <Empty description={t('analytics.empty')} style={{ padding: 48 }}>
          {
            canListEvents ? (
              <Link href={`/t/${tenantId}/events`}>
                <Button type="primary">{t('analytics.viewEvents')}</Button>
              </Link>
            ) : undefined
          }
        </Empty>
      ) : null}

      {page.kind === 'ready' ? (
        <>
          <ProTable<PortfolioItemView>
            rowKey={rowKey}
            dataSource={page.items}
            search={false}
            options={false}
            pagination={false}
            data-testid="portfolio-table"
            onRow={(row) => ({
              style: {
                cursor:
                  row.eventId && eventPath(row.eventId) ? 'pointer' : 'default',
              },
              onClick: () => {
                if (!row.eventId) return;
                const destination = eventPath(row.eventId);
                if (destination) window.location.assign(destination);
              },
            })}
            columns={[
              {
                title: t('analytics.col.event'),
                key: 'title',
                render: (_: unknown, row) => {
                  const label = row.title ?? '—';
                  if (!row.eventId) {
                    return (
                      <Tooltip
                        title={row.kind === 'unknown' ? row.message : undefined}
                      >
                        <span>{label}</span>
                      </Tooltip>
                    );
                  }
                  const destination = eventPath(row.eventId);
                  if (!destination) return <span>{label}</span>;
                  return (
                    <Link
                      href={destination}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {label}
                    </Link>
                  );
                },
              },
              {
                title: t('analytics.col.status'),
                key: 'status',
                render: () => (
                  <Tooltip title={t('analytics.col.statusTip')}>
                    <span>—</span>
                  </Tooltip>
                ),
              },
              {
                title: t('analytics.col.checkIn'),
                key: 'checkIn',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.checkInSuccessCount : null,
                  ),
              },
              {
                title: t('analytics.col.pending'),
                key: 'pending',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.pendingApprovalCount : null,
                  ),
              },
              {
                title: t('analytics.col.emailCs'),
                key: 'emailCs',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.emailNeedsCsCount : null,
                  ),
              },
              {
                title: t('analytics.col.quota'),
                key: 'quota',
                render: (_: unknown, row) => {
                  if (row.kind === 'unknown') {
                    return (
                      <Tooltip title={row.message}>
                        <span>—</span>
                      </Tooltip>
                    );
                  }
                  return formatQuotaRemaining(
                    row.quotaRemaining,
                    row.quotaCapacityState,
                    locale,
                  );
                },
              },
            ]}
          />
          {page.nextCursor ? (
            <Button onClick={() => void load(page.nextCursor, true)}>
              {t('sources.h_1w8bpuo')}
            </Button>
          ) : null}
        </>
      ) : null}
    </PortalPage>
  );
}
