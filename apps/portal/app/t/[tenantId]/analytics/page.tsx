'use client';

import { ProTable } from '@ant-design/pro-components';
import { Alert, Button, Tag, Tooltip } from 'antd';
import { PortalPage } from '../../../../src/components/portal-page';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { portalGet } from '../../../../src/client/portal-fetch';
import { SurfaceState } from '../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../src/i18n';
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

function metricCell(
  item: PortfolioItemView,
  value: number | null,
): ReactNode {
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
      <SurfaceState
        kind="error"
        description={access.messageKey ? t(access.messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied' || page.kind === 'rejected') {
    return (
      <SurfaceState
        kind="permission-denied"
        title="403"
        description={
          page.kind === 'rejected' ? page.message : t('analytics.deniedAccess')
        }
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }
  if (access.kind === 'loading' || page.kind === 'loading') {
    return <SurfaceState kind="loading" />;
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
        <SurfaceState
          kind="error"
          description={page.message}
          onRetry={() => void load(null, false)}
        />
      ) : null}

      {page.kind === 'empty' ? (
        <SurfaceState
          kind="empty"
          description={t('analytics.empty')}
          emptyAction={
            canListEvents ? (
              <Link href={`/t/${tenantId}/events`}>
                <Button type="primary">{t('analytics.viewEvents')}</Button>
              </Link>
            ) : undefined
          }
        />
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
              style: { cursor: row.eventId ? 'pointer' : 'default' },
              onClick: () => {
                if (!row.eventId) return;
                window.location.assign(
                  portfolioEventHref(tenantId, row.eventId),
                );
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
                        title={
                          row.kind === 'unknown' ? row.message : undefined
                        }
                      >
                        <span>{label}</span>
                      </Tooltip>
                    );
                  }
                  return (
                    <Link
                      href={portfolioEventHref(tenantId, row.eventId)}
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
