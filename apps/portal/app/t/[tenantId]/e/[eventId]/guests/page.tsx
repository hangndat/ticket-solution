'use client';

import { ProCard } from '@ant-design/pro-components';
import { Alert, Button, Flex, Result, Segmented, Select, Space, Spin } from 'antd';
import { PortalPage } from '../../../../../../src/components/portal-page';
import type { ReactNode } from 'react';
import { useActorState as useState } from '../../../../../../src/client/use-actor-state';
import { useParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { portalGet } from '../../../../../../src/client/portal-fetch';
import { ExportPanel } from '../../../../../../src/ops/panels/export-panel';
import { ImportInvitationsPanel } from '../../../../../../src/ops/panels/import-invitations-panel';
import { NotificationsOpsPanel } from '../../../../../../src/ops/panels/notifications-panel';
import { PendingPanel } from '../../../../../../src/ops/panels/pending-panel';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import {
  canAccessEventRoute,
  canPerformEventAction,
} from '../../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';
import { useCompactChrome } from '../../../../../../src/hooks/use-compact-chrome';
import { GuestWorkspace } from '../../../../../../src/guests/guest-workspace';
import { InContextHelp } from '../../../../../../src/components/in-context-help';

type CatalogItem = { id: string; label: string };

export default function EventGuestsPage() {
  const { t } = usePortalLocale();
  const compactChrome = useCompactChrome();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [sources, setSources] = useState<CatalogItem[]>([]);
  const [types, setTypes] = useState<CatalogItem[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('import');
  const [section, setSection] = useState<'list' | 'ops'>('list');
  const canLoadCatalog =
    access.kind === 'ready' && canAccessEventRoute('types', access.permissions);

  useEffect(() => {
    const syncTabFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (
        hash === 'pending' ||
        hash === 'notifications' ||
        hash === 'export' ||
        hash === 'import'
      ) {
        setActiveTab(hash);
        setSection('ops');
      }
    };
    queueMicrotask(syncTabFromHash);
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  useEffect(() => {
    if (!canLoadCatalog) return;
    let cancelled = false;
    void (async () => {
      const [s, ty] = await Promise.all([
        portalGet(`${bffEventAction(tenantId, eventId, 'sources')}?limit=50`),
        portalGet(
          `${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=50`,
        ),
      ]);
      if (cancelled) return;
      if (s.status === 200 && s.json && typeof s.json === 'object') {
        const items = Array.isArray((s.json as { items?: unknown }).items)
          ? (s.json as { items: Array<{ sourceId?: string; name?: string }> })
              .items
          : [];
        const mapped = items
          .filter((i) => typeof i.sourceId === 'string')
          .map((i) => ({
            id: i.sourceId!,
            label: i.name?.trim() || i.sourceId!,
          }));
        setSources(mapped);
        if (mapped[0]) setSourceId(mapped[0].id);
      } else {
        setCatalogError(t('guests.h_me551x'));
      }
      if (ty.status === 200 && ty.json && typeof ty.json === 'object') {
        const items = Array.isArray((ty.json as { items?: unknown }).items)
          ? (
              ty.json as {
                items: Array<{ ticketTypeId?: string; label?: string }>;
              }
            ).items
          : [];
        const mapped = items
          .filter((i) => typeof i.ticketTypeId === 'string')
          .map((i) => ({
            id: i.ticketTypeId!,
            label: i.label?.trim() || i.ticketTypeId!,
          }));
        setTypes(mapped);
        if (mapped[0]) setTicketTypeId(mapped[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canLoadCatalog, tenantId, eventId, t]);

  const permissions = useMemo(
    () => (access.kind === 'ready' ? access.permissions : []),
    [access],
  );
  const canImport = canPerformEventAction('importInventory', permissions);
  const canApprove = canPerformEventAction('approveRedemption', permissions);
  const canNotify = canPerformEventAction('sendNotification', permissions);
  const canExportCreate = canPerformEventAction('createExport', permissions);
  const canExportDownload = canPerformEventAction(
    'downloadExport',
    permissions,
  );
  const canExport = canExportCreate || canExportDownload;
  const canReadInvitations = canImport;
  const canReadRequests = canApprove;
  const canReadTickets = permissions.includes('cs.lookup');
  const canRead = canReadInvitations || canReadRequests || canReadTickets;
  const canOps = canImport || canApprove || canNotify || canExport;

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
  if (access.kind === 'permission-denied' || (!canOps && !canRead)) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('ops.guests.needPermissions')}
        extra={
          <Button type="primary" onClick={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}>
            {t(SURFACE_MESSAGE_KEYS.permissionGoAllowed)}
          </Button>
        }
      />
    );
  }

  const catalogSources = sources;
  const catalogTypes = types;

  const tabLabel = (
    fullKey: Parameters<typeof t>[0],
    shortKey: Parameters<typeof t>[0],
  ) => {
    const full = t(fullKey);
    const short = t(shortKey);
    const text = compactChrome ? short : full;
    return (
      <span title={full} aria-label={full}>
        {text}
      </span>
    );
  };

  const tabItems: { key: string; label: ReactNode; children: ReactNode }[] = [];
  if (canImport) {
    tabItems.push({
      key: 'import',
      label: tabLabel('ops.import.panelTitle', 'ops.import.tabLabel'),
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space
            wrap
            className="portal-guests-filters"
            role="group"
            aria-label={t('ops.import.catalogFiltersAria')}
            data-testid="import-catalog-filters"
          >
            <span>{t('nav.event.sources')}</span>
            <Select
              style={{
                minWidth: compactChrome ? undefined : 220,
                width: compactChrome ? '100%' : undefined,
              }}
              value={sourceId || undefined}
              placeholder={t('ops.import.chooseSource')}
              options={sources.map((s) => ({ value: s.id, label: s.label }))}
              onChange={setSourceId}
              aria-label={t('ops.h_1u6lt1m')}
            />
            <span>{t('nav.event.types')}</span>
            <Select
              style={{
                minWidth: compactChrome ? undefined : 220,
                width: compactChrome ? '100%' : undefined,
              }}
              value={ticketTypeId || undefined}
              placeholder={t('ops.import.chooseTicketType')}
              options={types.map((t) => ({ value: t.id, label: t.label }))}
              onChange={setTicketTypeId}
              aria-label={t('ops.h_1wib0ad')}
            />
          </Space>
          <ImportInvitationsPanel
            tenantId={tenantId}
            eventId={eventId}
            sourceId={sourceId}
            ticketTypeId={ticketTypeId}
          />
        </Space>
      ),
    });
  }
  if (canApprove) {
    tabItems.push({
      key: 'pending',
      label: tabLabel('guests.pendingTitle', 'guests.pendingTabLabel'),
      children: (
        <PendingPanel
          tenantId={tenantId}
          eventId={eventId}
          canApprove={canApprove}
          sources={catalogSources}
          ticketTypes={catalogTypes}
        />
      ),
    });
  }
  if (canNotify) {
    tabItems.push({
      key: 'notifications',
      label: tabLabel('guests.h_1avy3de', 'guests.notificationsTabLabel'),
      children: (
        <NotificationsOpsPanel
          tenantId={tenantId}
          eventId={eventId}
          canNotify={canNotify}
        />
      ),
    });
  }
  if (canExport) {
    tabItems.push({
      key: 'export',
      label: tabLabel('ops.export.panelInfo', 'ops.export.tabLabel'),
      children: (
        <ExportPanel
          tenantId={tenantId}
          eventId={eventId}
          canCreate={canExportCreate}
          canDownload={canExportDownload}
        />
      ),
    });
  }

  return (
    <PortalPage
      title={t(compactChrome ? 'nav.event.guestsCompact' : 'nav.event.guests')}
      subTitle={compactChrome ? undefined : t('guests.h_1tkjxlx')}
    >
      <InContextHelp messageKey="help.guests" testId="guests-help" />
      {catalogError ? (
        <Alert type="warning" showIcon message={catalogError} />
      ) : null}
      {canRead && canOps ? (
        <Segmented
          style={{ marginBottom: 16 }}
          value={section}
          options={[
            { label: t('guests.section.list'), value: 'list' },
            { label: t('guests.section.ops'), value: 'ops' },
          ]}
          onChange={(value) => setSection(value as 'list' | 'ops')}
        />
      ) : null}
      {canRead && (section === 'list' || !canOps) ? (
        <GuestWorkspace tenantId={tenantId} eventId={eventId} permissions={permissions} />
      ) : null}
      {canOps && (section === 'ops' || !canRead) ? <ProCard
        className="portal-guests-tabs"
        tabs={{
          activeKey: tabItems.some((tab) => tab.key === activeTab)
            ? activeTab
            : tabItems[0]?.key,
          onChange: (key) => {
            setActiveTab(key);
            window.location.hash = key;
          },
          items: tabItems,
        }}
      /> : null}
    </PortalPage>
  );
}
