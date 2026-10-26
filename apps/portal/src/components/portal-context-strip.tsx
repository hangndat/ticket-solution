'use client';

import { Select, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { usePortalLocale } from '../i18n';
import {
  firstAllowedEventPath,
  firstAllowedTenantPath,
} from '../nav/capability-policy';

export type PortalContextStripProps = {
  tenants: MeTenantItem[];
  events: MeEventItem[];
  tenantEvents: MeEventItem[];
  resolvedTenantId: string | null;
  effectiveEventId: string | null;
  showGateScanHint: boolean;
};

export function PortalContextStrip({
  tenants,
  events,
  tenantEvents,
  resolvedTenantId,
  effectiveEventId,
  showGateScanHint,
}: PortalContextStripProps) {
  const { t } = usePortalLocale();
  const router = useRouter();
  const selectableTenants = tenants.filter((tenant) =>
    firstAllowedTenantPath(tenant, events),
  );
  const selectableEvents = tenantEvents.filter((event) =>
    firstAllowedEventPath(event),
  );

  const tenantLabelId = 'portal-context-tenant-label';
  const eventLabelId = 'portal-context-event-label';

  return (
    <div className="portal-context-strip" data-testid="portal-context-strip">
      <div className="portal-context-strip__row">
        <div className="portal-context-strip__field">
          <label id={tenantLabelId} className="portal-context-strip__label">
            {t('shell.tenant.label')}
          </label>
          <Select
            aria-labelledby={tenantLabelId}
            placeholder={
              selectableTenants.length === 0
                ? t('shell.tenant.empty')
                : t('shell.tenant.placeholder')
            }
            value={resolvedTenantId ?? undefined}
            options={selectableTenants.map((tenant) => ({
              value: tenant.tenantId,
              label: `${tenant.name} (${tenant.slug})`,
              title: `${tenant.name} (${tenant.slug})`,
            }))}
            onChange={(value) => {
              const tenant = tenants.find((item) => item.tenantId === value);
              const destination =
                tenant && firstAllowedTenantPath(tenant, events);
              if (destination) router.push(destination);
            }}
            disabled={selectableTenants.length === 0}
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
                : selectableEvents.length === 0
                  ? t('shell.event.empty')
                  : t('shell.event.placeholder')
            }
            value={effectiveEventId ?? undefined}
            options={selectableEvents.map((e) => ({
              value: e.eventId,
              label: e.name,
              title: e.name,
            }))}
            onChange={(value) => {
              if (resolvedTenantId) {
                const event = tenantEvents.find(
                  (item) => item.eventId === value,
                );
                const destination = event && firstAllowedEventPath(event);
                if (destination) router.push(destination);
              }
            }}
            disabled={!resolvedTenantId || selectableEvents.length === 0}
            data-testid="event-switcher"
            allowClear
            onClear={() => {
              const tenant = tenants.find(
                (item) => item.tenantId === resolvedTenantId,
              );
              const destination =
                tenant && firstAllowedTenantPath(tenant, tenantEvents);
              if (destination) router.push(destination);
            }}
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
