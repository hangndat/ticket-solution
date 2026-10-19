'use client';

import { Alert, Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { portalGet } from '../../../../src/client/portal-fetch';
import { SurfaceState } from '../../../../src/components/surface-state';
import {
  PORTFOLIO_PARTIAL_ALERT,
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
      );

      if (view.kind === 'unknown') {
        setPage({ kind: 'unknown', message: view.message });
        return;
      }
      if (view.kind === 'rejected') {
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          setPage({
            kind: 'rejected',
            message:
              'Không có quyền xem phân tích tổ chức — cần report.read và phân công sự kiện.',
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
    [tenantId],
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

  if (access.kind === 'loading' || page.kind === 'loading') {
    return <SurfaceState kind="loading" />;
  }
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.message}
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
          page.kind === 'rejected'
            ? page.message
            : 'Cần report.read và phân công ít nhất một sự kiện — không suy từ tên role.'
        }
        onRetry={() => {
          window.location.href = `/t/${tenantId}`;
        }}
      />
    );
  }

  const canListEvents = access.tenant.tenantPermissions.includes('event.list');
  const asOf =
    page.kind === 'ready' || page.kind === 'empty' ? page.asOf : null;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        wrap
        align="start"
      >
        <Space direction="vertical" size={4}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Phân tích
          </Typography.Title>
          {asOf ? (
            <Tag data-testid="portfolio-asof">
              Server ghi nhận {formatReportAsOf(asOf)}
            </Tag>
          ) : null}
        </Space>
        <Button
          type="primary"
          onClick={() => void load(null, false)}
          data-testid="portfolio-refresh"
        >
          Làm mới
        </Button>
      </Space>

      {page.kind === 'ready' && page.hasPartial ? (
        <Alert
          type="warning"
          showIcon
          message={PORTFOLIO_PARTIAL_ALERT}
          data-testid="portfolio-partial-alert"
        />
      ) : null}

      {page.kind === 'unknown' ? (
        <Alert
          type="warning"
          showIcon
          message="Chưa rõ kết quả"
          description={page.message}
          action={
            <Button size="small" onClick={() => void load(null, false)}>
              Kiểm tra lại
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
          description="Chưa có sự kiện được gán quyền báo cáo"
          emptyAction={
            canListEvents ? (
              <Link href={`/t/${tenantId}/events`}>
                <Button type="primary">Xem sự kiện</Button>
              </Link>
            ) : undefined
          }
        />
      ) : null}

      {page.kind === 'ready' ? (
        <>
          <Table<PortfolioItemView>
            rowKey={rowKey}
            dataSource={page.items}
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
                title: 'Sự kiện',
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
                title: 'Trạng thái',
                key: 'status',
                render: () => (
                  <Tooltip title="Trạng thái nội dung không có trên portfolio API — không bịa.">
                    <span>—</span>
                  </Tooltip>
                ),
              },
              {
                title: 'Check-in',
                key: 'checkIn',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.checkInSuccessCount : null,
                  ),
              },
              {
                title: 'Pending',
                key: 'pending',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.pendingApprovalCount : null,
                  ),
              },
              {
                title: 'Email cần CS',
                key: 'emailCs',
                render: (_: unknown, row) =>
                  metricCell(
                    row,
                    row.kind === 'shown' ? row.emailNeedsCsCount : null,
                  ),
              },
              {
                title: 'Quota còn',
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
                  );
                },
              },
            ]}
          />
          {page.nextCursor ? (
            <Button onClick={() => void load(page.nextCursor, true)}>
              Tải thêm
            </Button>
          ) : null}
        </>
      ) : null}
    </Space>
  );
}
