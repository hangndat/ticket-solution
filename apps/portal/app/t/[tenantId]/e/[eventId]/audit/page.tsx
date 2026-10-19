'use client';

import { ProCard } from '@ant-design/pro-components';
import { PortalPage } from '../../../../../../src/components/portal-page';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from '../../../../../../src/ops/panels/audit-panel';
import { CodesPanel } from '../../../../../../src/ops/panels/codes-panel';
import { ExportPanel } from '../../../../../../src/ops/panels/export-panel';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { SurfaceState } from '../../../../../../src/components/surface-state';
import { usePortalLocale } from '../../../../../../src/i18n';

export default function EventAuditPage() {
  const { t } = usePortalLocale();
  const params = useParams<{ tenantId: string; eventId: string }>();
  const { tenantId, eventId } = params;
  const access = useEventAccess(tenantId, eventId);
  const [activeTab, setActiveTab] = useState('audit');

  const permissions = useMemo(
    () => (access.kind === 'ready' ? access.permissions : []),
    [access],
  );
  const canAudit = permissions.includes('report.read');
  const canCodes = permissions.includes('inventory.import');
  const canExportCreate = permissions.includes('export.create');
  const canExportDownload = permissions.includes('export.download');
  const canExport = canExportCreate || canExportDownload;
  const canJobs = canAudit || canCodes || canExport;

  useEffect(() => {
    queueMicrotask(() => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'codes' || hash === 'jobs' || hash === 'audit') {
        setActiveTab(hash);
      }
    });
  }, []);

  if (access.kind === 'loading') return <SurfaceState kind="loading" />;
  if (access.kind === 'error') {
    return (
      <SurfaceState
        kind="error"
        description={access.messageKey ? t(access.messageKey) : undefined}
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (access.kind === 'permission-denied' || !canJobs) {
    return (
      <SurfaceState
        kind="permission-denied"
        description={t('ops.report.needPermissions')}
        onRetry={() => {
          window.location.href = `/t/${tenantId}/e/${eventId}`;
        }}
      />
    );
  }

  const tabItems: { key: string; label: string; children: ReactNode }[] = [];
  if (canAudit) {
    tabItems.push({
      key: 'audit',
      label: t('audit.h_pug8u'),
      children: <AuditPanel tenantId={tenantId} eventId={eventId} />,
    });
  }
  if (canCodes) {
    tabItems.push({
      key: 'codes',
      label: t('audit.h_1psplgo'),
      children: <CodesPanel tenantId={tenantId} eventId={eventId} />,
    });
  }
  if (canExport) {
    tabItems.push({
      key: 'jobs',
      label: t('audit.tab.exportHistory'),
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
      title={t('nav.event.auditCodes')}
      subTitle={t('ops.audit.capabilityHint')}
    >
      <ProCard
        tabs={{
          activeKey:
            tabItems.some((tab) => tab.key === activeTab)
              ? activeTab
              : tabItems[0]?.key,
          onChange: (key) => {
            setActiveTab(key);
            window.location.hash = key;
          },
          items: tabItems,
        }}
      />
    </PortalPage>
  );
}
