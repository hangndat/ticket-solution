'use client';

import { Alert, Button, Descriptions, Typography } from 'antd';
import { useCallback, useEffect } from 'react';
import { useActorState as useState } from '../client/use-actor-state';
import { portalGet } from '../client/portal-fetch';
import { usePortalLocale } from '../i18n';
import { formatReportAsOf } from '../ops/report';
import {
  formatConfiguredCap,
  interpretTenantLimitsUsage,
  type TenantLimitsUsageView,
} from '../ops/tenant-limits-usage';
import { bffTenantLimits } from '../prep/bff-urls';

export function TenantLimitsCard({ tenantId }: { tenantId: string }) {
  const { t, locale } = usePortalLocale();
  const [view, setView] = useState<TenantLimitsUsageView>({
    kind: 'unknown',
    message: t('limits.usage.unknown'),
  });

  const load = useCallback(async () => {
    const res = await portalGet(bffTenantLimits(tenantId));
    setView(
      interpretTenantLimitsUsage(
        res.status,
        res.json,
        res.networkError || res.timedOut,
        locale,
      ),
    );
  }, [tenantId, locale]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (view.kind === 'forbidden') return null;
  if (view.kind === 'unknown' || view.kind === 'rejected') {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        data-testid="tenant-limits-unknown"
        message={t('limits.usage.title')}
        description={view.message}
        action={
          <Button size="small" onClick={() => void load()}>
            {t('surface.action.recheck')}
          </Button>
        }
      />
    );
  }

  const { snapshot } = view;
  return (
    <div data-testid="tenant-limits-card" style={{ marginBottom: 16 }}>
      <Descriptions title={t('limits.usage.title')} column={1} size="small">
        <Descriptions.Item label={t('limits.usage.events')}>
          {snapshot.usage.events} / {formatConfiguredCap(snapshot.limits.maxEvents, locale)}
        </Descriptions.Item>
        <Descriptions.Item label={t('limits.usage.staff')}>
          {snapshot.usage.staffActive + snapshot.usage.staffPendingInvites} /{' '}
          {formatConfiguredCap(snapshot.limits.maxStaff, locale)}
        </Descriptions.Item>
        <Descriptions.Item label={t('limits.usage.email')}>
          {snapshot.usage.emailToday} / {formatConfiguredCap(snapshot.limits.emailPerDay, locale)}
        </Descriptions.Item>
        <Descriptions.Item label={t('limits.usage.importRows')}>
          {formatConfiguredCap(snapshot.limits.importRowsPerJob, locale)}
        </Descriptions.Item>
      </Descriptions>
      <Typography.Paragraph type="secondary" data-testid="tenant-limits-asof">
        {t('limits.usage.asOf', { asOf: formatReportAsOf(snapshot.asOf, locale) })}
      </Typography.Paragraph>
    </div>
  );
}
