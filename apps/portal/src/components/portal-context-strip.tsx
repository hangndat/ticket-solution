'use client';

import { Select, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import type { MeTenantItem } from '@ticket/contracts';
import { usePortalLocale } from '../i18n';
import { routeAfterEventSelectChange } from '../nav/portal-context-routes';

export type PortalContextStripProps = {
  tenants: MeTenantItem[];
  tenantEvents: Array<{ eventId: string; name: string; tenantId: string }>;
  resolvedTenantId: string | null;
  effectiveEventId: string | null;
  showGateScanHint: boolean;
};

export function PortalContextStrip({
  tenants,
  tenantEvents,
  resolvedTenantId,
  effectiveEventId,
  showGateScanHint,
}: PortalContextStripProps) {
  const { t } = usePortalLocale();
  const router = useRouter();

  const tenantLabelId = 'portal-context-tenant-label';
  const eventLabelId = 'portal-context-event-label';

  return (
    <div
      className="portal-context-strip"
      data-testid="portal-context-strip"
    >
      <div className="portal-context-strip__row">
        <div className="portal-context-strip__field">
          <label id={tenantLabelId} className="portal-context-strip__label">
            {t('shell.tenant.label')}
          </label>
          <Select
            aria-labelledby={tenantLabelId}
            placeholder={
              tenants.length === 0
                ? t('shell.tenant.empty')
                : t('shell.tenant.placeholder')
            }
            value={resolvedTenantId ?? undefined}
            options={tenants.map((tenant) => ({
              value: tenant.tenantId,
              label: `${tenant.name} (${tenant.slug})`,
              title: `${tenant.name} (${tenant.slug})`,
            }))}
            onChange={(value) => {
              router.push(`/t/${value}`);
            }}
            disabled={tenants.length === 0}
            data-testid="tenant-switcher"
          />
        </div>
        <div className="portal-context-strip__field">
          <label id={eventLabelId} className="portal-context-strip__label">
            {t('nav.org.events')}
          </label>
          <Select
            aria-labelledby={eventLabelId}
            placeholder={
              !resolvedTenantId
                ? t('shell.event.selectTenantFirst')
                : tenantEvents.length === 0
                  ? t('shell.event.empty')
                  : t('shell.event.placeholder')
            }
            value={effectiveEventId ?? undefined}
            options={tenantEvents.map((e) => ({
              value: e.eventId,
              label: e.name,
              title: e.name,
            }))}
            onChange={(value) => {
              const target = routeAfterEventSelectChange(
                resolvedTenantId ?? '',
                value,
              );
              if (target) router.push(target);
            }}
            disabled={!resolvedTenantId || tenantEvents.length === 0}
            data-testid="event-switcher"
            allowClear
          />
        </div>
        {showGateScanHint ? (
          <Typography.Text
            type="secondary"
            className="portal-context-strip__hint"
            data-testid="gate-ios-scan-hint"
          >
            {t('gateDeeplink.h_iosHint')}
          </Typography.Text>
        ) : null}
      </div>
    </div>
  );
}
