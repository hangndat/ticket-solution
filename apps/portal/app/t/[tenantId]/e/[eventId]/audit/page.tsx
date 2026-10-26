'use client';

import { Alert, Button, Flex, Result, Spin } from 'antd';
import { ProCard } from '@ant-design/pro-components';
import { PortalPage } from '../../../../../../src/components/portal-page';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuditPanel } from '../../../../../../src/ops/panels/audit-panel';
import { CodesPanel } from '../../../../../../src/ops/panels/codes-panel';
import { ExportPanel } from '../../../../../../src/ops/panels/export-panel';
import { useEventAccess } from '../../../../../../src/prep/use-event-access';
import { canPerformEventAction } from '../../../../../../src/nav/capability-policy';
import { usePortalLocale } from '../../../../../../src/i18n';
import { SURFACE_MESSAGE_KEYS } from '../../../../../../src/prep/surface-copy';

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
  const canAudit = canPerformEventAction('readReport', permissions);
  const canCodes = canPerformEventAction('readCodes', permissions);
  const canExportCreate = canPerformEventAction('createExport', permissions);
  const canExportDownload = canPerformEventAction(
    'downloadExport',
    permissions,
  );
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
  if (access.kind === 'permission-denied' || !canJobs) {
    return (
      <Result
        status="403"
        title={t(SURFACE_MESSAGE_KEYS.permissionTitle)}
        subTitle={t('ops.report.needPermissions')}
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
          activeKey: tabItems.some((tab) => tab.key === activeTab)
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
