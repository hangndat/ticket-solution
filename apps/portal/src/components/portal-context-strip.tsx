'use client';

import { message, Select, Typography } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import type { MeEventItem, MeTenantItem } from '@ticket/contracts';
import { usePortalLocale } from '../i18n';
import {
  canAccessTenantRoute,
  firstAllowedEventPath,
  firstAllowedTenantPath,
} from '../nav/capability-policy';
import {
  eventSwitchDestination,
  tenantSwitchDestination,
} from '../nav/context-destination';
import { confirmDiscardIfDirty } from '../nav/unsaved-changes';

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
  const pathname = usePathname();
  const selectableTenants = tenants.filter((tenant) =>
    firstAllowedTenantPath(tenant, events),
  );
  const selectableEvents = tenantEvents.filter((event) =>
    firstAllowedEventPath(event),
  );
  const activeTenant = tenants.find(
    (item) => item.tenantId === resolvedTenantId,
  );
  const canClearEvent = Boolean(
    activeTenant &&
    (canAccessTenantRoute(
      'overview',
      activeTenant.tenantPermissions,
      tenantEvents.map((event) => event.permissions),
    ) ||
      canAccessTenantRoute(
        'analytics',
        activeTenant.tenantPermissions,
        tenantEvents.map((event) => event.permissions),
      )),
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
                tenant && tenantSwitchDestination(pathname, tenant, events);
              if (
                destination &&
                confirmDiscardIfDirty(t('shell.unsaved.confirm'))
              ) {
                if (!destination.preserved)
                  void message.info(t('shell.context.fallback'));
                router.push(destination.path);
              }
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
                const destination =
                  event && eventSwitchDestination(pathname, event);
                if (
                  destination &&
                  confirmDiscardIfDirty(t('shell.unsaved.confirm'))
                ) {
                  if (!destination.preserved)
                    void message.info(t('shell.context.fallback'));
                  router.push(destination.path);
                }
              }
            }}
            disabled={!resolvedTenantId || selectableEvents.length === 0}
            data-testid="event-switcher"
            allowClear={canClearEvent}
            onClear={() => {
              if (
                !activeTenant ||
                !confirmDiscardIfDirty(t('shell.unsaved.confirm'))
              )
                return;
              const base = `/t/${activeTenant.tenantId}`;
              const destination = canAccessTenantRoute(
                'overview',
                activeTenant.tenantPermissions,
                tenantEvents.map((event) => event.permissions),
              )
                ? base
                : `${base}/analytics`;
              router.push(destination);
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
