'use client';

import { Alert, Select, Space, Tabs, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { portalGet } from '../../../../../../src/client/portal-fetch';
import { ExportPanel } from '../../../../../../src/ops/panels/export-panel';
import { ImportInvitationsPanel } from '../../../../../../src/ops/panels/import-invitations-panel';
import { NotificationsOpsPanel } from '../../../../../../src/ops/panels/notifications-panel';
import { PendingPanel } from '../../../../../../src/ops/panels/pending-panel';
import { bffEventAction } from '../../../../../../src/prep/bff-urls';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';

type CatalogItem = { id: string; label: string };

export default function EventGuestsPage() {
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [sources, setSources] = useState<CatalogItem[]>([]);
  const [types, setTypes] = useState<CatalogItem[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('import');

  useEffect(() => {
    queueMicrotask(() => {
      const hash = window.location.hash.replace('#', '');
      if (
        hash === 'pending' ||
        hash === 'notifications' ||
        hash === 'export' ||
        hash === 'import'
      ) {
        setActiveTab(hash);
      }
    });
  }, []);

  useEffect(() => {
    if (access.kind !== 'ready') return;
    let cancelled = false;
    void (async () => {
      const [s, t] = await Promise.all([
        portalGet(
          `${bffEventAction(tenantId, eventId, 'sources')}?limit=50`,
        ),
        portalGet(
          `${bffEventAction(tenantId, eventId, 'ticket-types')}?limit=50`,
        ),
      ]);
      if (cancelled) return;
      if (s.status === 200 && s.json && typeof s.json === 'object') {
        const items = Array.isArray((s.json as { items?: unknown }).items)
          ? ((s.json as { items: Array<{ sourceId?: string; name?: string }> })
              .items)
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
        setCatalogError('Không tải được sources — không gõ UUID tay.');
      }
      if (t.status === 200 && t.json && typeof t.json === 'object') {
        const items = Array.isArray((t.json as { items?: unknown }).items)
          ? ((
              t.json as {
                items: Array<{ ticketTypeId?: string; label?: string }>;
              }
            ).items)
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
  }, [access.kind, tenantId, eventId]);

  const permissions = useMemo(
    () => (access.kind === 'ready' ? access.permissions : []),
    [access],
  );
  const canImport = permissions.includes('inventory.import');
  const canApprove = permissions.includes('redemption.approve');
  const canNotify = permissions.includes('notify.send');
  const canExportCreate = permissions.includes('export.create');
  const canExportDownload = permissions.includes('export.download');
  const canExport = canExportCreate || canExportDownload;
  const canOps =
    canImport || canApprove || canNotify || canExport;

  if (access.kind === 'loading') return <SurfaceState kind="loading" />;
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.message}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied' || !canOps) {
    return (
      <SurfaceState
        kind="permission-denied"
        description="Cần inventory.import / redemption.approve / notify.send / export.* từ máy chủ."
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}
      />
    );
  }

  const catalogSources = sources;
  const catalogTypes = types;

  const tabItems: { key: string; label: string; children: ReactNode }[] = [];
  if (canImport) {
    tabItems.push({
      key: 'import',
      label: 'Import & invitations',
      children: (
        <ImportInvitationsPanel
          tenantId={tenantId}
          eventId={eventId}
          sourceId={sourceId}
          ticketTypeId={ticketTypeId}
        />
      ),
    });
  }
  if (canApprove) {
    tabItems.push({
      key: 'pending',
      label: 'Chờ duyệt',
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
      label: 'Thông báo',
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
      label: 'Export',
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
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={3} style={{ margin: 0 }}>
        Khách & mã
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        message="Import / invitations / pending / notify / export"
        description="Preview không giữ quota. ACCEPTED ≠ DELIVERED. Source/type chọn từ catalog — không nhập UUID tay."
      />
      {catalogError ? (
        <Alert type="warning" showIcon message={catalogError} />
      ) : null}
      {canImport ? (
        <Space wrap>
          <span>Nguồn mã</span>
          <Select
            style={{ minWidth: 220 }}
            value={sourceId || undefined}
            placeholder="Chọn source"
            options={sources.map((s) => ({ value: s.id, label: s.label }))}
            onChange={setSourceId}
          />
          <span>Loại vé</span>
          <Select
            style={{ minWidth: 220 }}
            value={ticketTypeId || undefined}
            placeholder="Chọn ticket type"
            options={types.map((t) => ({ value: t.id, label: t.label }))}
            onChange={setTicketTypeId}
          />
        </Space>
      ) : null}
      <Tabs
        activeKey={
          tabItems.some((t) => t.key === activeTab) ? activeTab : tabItems[0]?.key
        }
        onChange={setActiveTab}
        items={tabItems}
      />
    </Space>
  );
}
